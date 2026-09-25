from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, status
from fastapi.responses import JSONResponse
from io import BytesIO
import redis.asyncio as aioredis
import httpx
from datetime import datetime, timezone
from bson import ObjectId
from pypdf import PdfReader
import asyncio
from .database import documents_collection
from .models import DocumentResponse
import os

app = FastAPI()
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
RECORD_TYPES = {
    "chain_of_custody",
    "field_notes",
    "lab_report",
    "calibration_record",
    "other",
}

# Redis connection for Pub/Sub
redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis_cache:6379"))

async def index_user_documents(records, user_id):
    semaphore = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=5.0) as client:
        async def index_one(record):
            async with semaphore:
                try:
                    response = await client.post(
                        "http://search-service:5001/index",
                        json={"doc_id": record["doc_id"], "title": record["title"], "content": record["content"]},
                        headers={"x-user-id": str(user_id)}
                    )
                    response.raise_for_status()
                    return True
                except Exception:
                    return False

        results = await asyncio.gather(*(index_one(record) for record in records))
    failures = results.count(False)
    if failures:
        print(f"[ERROR] Failed to synchronize {failures} user evidence records with search")

# --- HEALTH CHECK ---
@app.get("/health")
async def health():
    return {"status": "OK"}

# --- UPLOAD DOCUMENT ---
@app.post("/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=1, max_length=180),
    record_type: str = Form("other"),
    sample_id: str = Form("", max_length=80),
    site_name: str = Form("", max_length=120),
    x_user_id: str = Header(...)  # Injected by Node.js Gateway
):
    # 1. Convert user_id to int (it comes as a string from the header)
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    title = title.strip()
    record_type = record_type.strip().lower()
    sample_id = sample_id.strip().upper()
    site_name = site_name.strip()
    if not title:
        raise HTTPException(status_code=400, detail="A document title is required")
    if record_type not in RECORD_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported evidence record type")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 20 MB or smaller")
    if file.content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
        try:
            pdf = PdfReader(BytesIO(content), strict=False)
            if len(pdf.pages) > 100:
                raise HTTPException(status_code=413, detail="PDFs must contain 100 pages or fewer")
            text_content = "\n".join(page.extract_text() or "" for page in pdf.pages).strip()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="This PDF could not be read")
        if not text_content:
            raise HTTPException(status_code=422, detail="This PDF has no selectable text; use image extraction for a scan")
    else:
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=415, detail="Use a text, CSV, or searchable PDF file; send scans through image extraction")
    if not text_content.strip():
        raise HTTPException(status_code=422, detail="The selected file contains no searchable text")

    # 3. Prepare the document for MongoDB
    doc_data = {
        "title": title,
        "filename": file.filename,
        "content": text_content,
        "user_id": user_id,
        "record_type": record_type,
        "sample_id": sample_id or None,
        "site_name": site_name or None,
        "created_at": datetime.now(timezone.utc)
    }

    # 4. Insert into MongoDB
    result = await documents_collection.insert_one(doc_data)
    doc_id = str(result.inserted_id)
    await redis.delete(f"user_docs:v2:{user_id}")

    # 5. Publish to Redis for WebSocket notifications
    # Node.js is subscribed to "upload_channel", so it will push this to React.
    await redis.publish("upload_channel", doc_id)

    # 6. Send to Flask Search Service for indexing (Service-to-Service call)
    # We use httpx for async HTTP requests.
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://search-service:5001/index",
                json={
                    "doc_id": doc_id,
                    "title": title,
                    "content": text_content
                },
                headers={"x-user-id": str(user_id)},
                timeout=5.0
            )
            response.raise_for_status()
        except Exception as e:
            # Log the error but don't fail the request. The document is already saved.
            print(f"[ERROR] Failed to index document in search service: {e}")

    return {"id": doc_id, "message": "Document uploaded successfully"}

# --- LIST DOCUMENTS FOR CURRENT USER ---
import json

@app.get("/documents", response_model=list[DocumentResponse])
async def list_documents(x_user_id: str = Header(...)):
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # --- CACHE CHECK ---
    cache_key = f"user_docs:v2:{user_id}"
    cached_docs = await redis.get(cache_key)
    
    if cached_docs:
        # Redis returns bytes, so we decode and parse it back to JSON
        return json.loads(cached_docs)

    # --- IF NOT CACHED, QUERY DB ---
    cursor = documents_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    
    docs = []
    search_records = []
    async for doc in cursor:
        content = doc.get("content")
        if isinstance(content, str) and content.strip():
            search_records.append({
                "doc_id": str(doc["_id"]),
                "title": doc["title"],
                "content": content,
            })
        docs.append({
            "id": str(doc["_id"]),
            "title": doc["title"],
            "filename": doc.get("filename", ""),
            "record_type": doc.get("record_type", "other"),
            "sample_id": doc.get("sample_id"),
            "site_name": doc.get("site_name"),
            "user_id": doc["user_id"],
            "created_at": doc["created_at"]
        })

    await index_user_documents(search_records, user_id)

    # --- STORE IN CACHE FOR 60 SECONDS ---
    # Need to convert datetime to isoformat for caching, but for response, DocumentResponse handles datetime
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return super().default(obj)
            
    await redis.setex(cache_key, 60, json.dumps(docs, cls=DateTimeEncoder))
    
    return docs
