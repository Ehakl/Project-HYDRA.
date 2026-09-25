from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Query
from fastapi.responses import JSONResponse
import easyocr
from sentence_transformers import SentenceTransformer
import numpy as np
import google.generativeai as genai
from google.api_core.exceptions import NotFound, ResourceExhausted
import os
import json
from pymongo import MongoClient

app = FastAPI()
gemini_api_key = os.getenv("GEMINI_API_KEY", "")

# --- INITIALIZE AI MODELS (Loaded once on startup) ---
# EasyOCR supports 80+ languages. We'll use English for now.
print("Loading EasyOCR...")
ocr_reader = easyocr.Reader(['en'], gpu=False) # Set gpu=True if you have CUDA
print("Loading Sentence Transformer...")
embedder = SentenceTransformer('all-MiniLM-L6-v2') # Lightweight, fast, 384-dim embeddings

# --- CONFIGURE GEMINI ---
llm = None
if gemini_api_key and gemini_api_key != "your_gemini_api_key_here":
    genai.configure(api_key=gemini_api_key)
    llm = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-flash-latest"))

# --- MONGO CONNECTION ---
mongo_client = MongoClient(os.getenv("MONGO_URI", "mongodb://mongo_db:27017"))
db = mongo_client.hydra_docs
documents_collection = db.documents

@app.post("/extract")
async def process_ocr(
    file: UploadFile = File(...),
    x_user_id: str = Header(...)
):
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="A valid user identity is required")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Choose an image file for text extraction")
    image_bytes = await file.read(10 * 1024 * 1024 + 1)
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be 10 MB or smaller")
    
    # 2. Extract text using EasyOCR
    # EasyOCR returns a list of tuples: (bbox, text, confidence)
    results = ocr_reader.readtext(image_bytes, detail=0)
    extracted_text = " ".join(results)
    
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No text found in image")

    return {"filename": file.filename, "extracted_text": extracted_text}

@app.post("/assistant-query")
def rag_query(
    query: str = Query(..., min_length=2, max_length=1000),
    x_user_id: str = Header(...)
):
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="A valid user identity is required")

    if llm is None:
        raise HTTPException(
            status_code=503,
            detail="Document answers are unavailable until GEMINI_API_KEY is configured"
        )

    documents = documents_collection.find(
        {"user_id": user_id, "content": {"$type": "string", "$ne": ""}},
        {"title": 1, "content": 1, "sample_id": 1, "site_name": 1, "record_type": 1}
    ).sort("created_at", -1).limit(200)
    candidates = []
    for document in documents:
        content = str(document.get("content") or "").strip()
        if content and content != "Binary file - content not indexed":
            metadata = f"Sample ID: {document.get('sample_id') or 'not linked'}; site: {document.get('site_name') or 'not recorded'}; record type: {document.get('record_type', 'other')}"
            candidates.append((document, f"{metadata}\n{content[:6000]}"))

    if not candidates:
        return {"query": query, "answer": "No searchable evidence is in this workspace yet.", "sources": []}

    vectors = embedder.encode(
        [query] + [content for _, content in candidates],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False
    )
    scores = vectors[1:] @ vectors[0]
    best_indices = np.argsort(scores)[::-1][:3]
    sources = []
    context_parts = []
    for source_number, candidate_index in enumerate(best_indices, start=1):
        document, content = candidates[int(candidate_index)]
        source_id = str(document["_id"])
        label = f"E{source_number}"
        sources.append({
            "id": source_id,
            "label": label,
            "title": document.get("title", "Untitled evidence"),
            "sample_id": document.get("sample_id"),
            "site_name": document.get("site_name"),
            "record_type": document.get("record_type", "other"),
            "relevance": round(float(scores[candidate_index]), 3),
            "excerpt": content[:600]
        })
        context_parts.append(f"[{label}] {document.get('title', 'Untitled evidence')}\n{content[:3000]}")

    context = "\n\n".join(context_parts)
    prompt = f"""
    You help environmental testing teams review their own sample evidence.
    Answer only from the evidence below. If it does not support an answer, say so.
    Cite each factual statement with its evidence label, such as [E1].
    Do not claim that records establish regulatory compliance or replace professional review.
    
    Evidence:\n{context}
    Question: {query}
    Answer:
    """

    try:
        response = llm.generate_content(prompt)
    except ResourceExhausted:
        return JSONResponse(status_code=429, content={
            "detail": "Gemini quota is currently exhausted. Check the API project quota or retry later.",
            "sources": sources
        })
    except NotFound:
        return JSONResponse(status_code=503, content={
            "detail": "The configured Gemini model is unavailable. Set GEMINI_MODEL to a supported generation model.",
            "sources": sources
        })
    except Exception:
        print("[ERROR] Gemini generation failed")
        return JSONResponse(status_code=502, content={
            "detail": "The document assistant could not complete this request.",
            "sources": sources
        })

    return {
        "query": query,
        "answer": response.text or "The assistant returned no answer for the selected evidence.",
        "sources": sources
    }