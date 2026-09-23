from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, status
from fastapi.responses import JSONResponse
import redis.asyncio as aioredis
import httpx
from datetime import datetime
from bson import ObjectId
from .database import documents_collection
from .models import DocumentResponse
import os

app = FastAPI()

# Redis connection for Pub/Sub
redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis_cache:6379"))

# --- HEALTH CHECK ---
@app.get("/health")
async def health():
    return {"status": "OK"}

# --- UPLOAD DOCUMENT ---
@app.post("/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    x_user_id: str = Header(...)  # Injected by Node.js Gateway
):
    # 1. Convert user_id to int (it comes as a string from the header)
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # 2. Read the file content. For large files, we'd use GridFS, but for now,
    # we'll store the text content directly (good for snippets/text files).
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        text_content = "Binary file - content not indexed"

    # 3. Prepare the document for MongoDB
    doc_data = {
        "title": title,
        "filename": file.filename,
        "content": text_content,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    }

    # 4. Insert into MongoDB
    result = await documents_collection.insert_one(doc_data)
    doc_id = str(result.inserted_id)

    # 5. Publish to Redis for WebSocket notifications
    # Node.js is subscribed to "upload_channel", so it will push this to React.
    await redis.publish("upload_channel", doc_id)

    # 6. Send to Flask Search Service for indexing (Service-to-Service call)
    # We use httpx for async HTTP requests.
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                "http://search-service:5001/index",
                json={
                    "doc_id": doc_id,
                    "title": title,
                    "content": text_content
                },
                timeout=5.0
            )
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
    cache_key = f"user_docs:{user_id}"
    cached_docs = await redis.get(cache_key)
    
    if cached_docs:
        # Redis returns bytes, so we decode and parse it back to JSON
        return json.loads(cached_docs)

    # --- IF NOT CACHED, QUERY DB ---
    cursor = documents_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    
    docs = []
    async for doc in cursor:
        docs.append({
            "id": str(doc["_id"]),
            "title": doc["title"],
            "content": doc.get("content"),
            "user_id": doc["user_id"],
            "created_at": doc["created_at"]
        })

    # --- STORE IN CACHE FOR 60 SECONDS ---
    # Need to convert datetime to isoformat for caching, but for response, DocumentResponse handles datetime
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return super().default(obj)
            
    await redis.setex(cache_key, 60, json.dumps(docs, cls=DateTimeEncoder))
    
    return docs
