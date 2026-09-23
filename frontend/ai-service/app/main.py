from fastapi import FastAPI, UploadFile, File, Header, HTTPException
import easyocr
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import google.generativeai as genai
import os
import json
from pymongo import MongoClient

app = FastAPI()

# --- INITIALIZE AI MODELS (Loaded once on startup) ---
# EasyOCR supports 80+ languages. We'll use English for now.
print("Loading EasyOCR...")
ocr_reader = easyocr.Reader(['en'], gpu=False) # Set gpu=True if you have CUDA
print("Loading Sentence Transformer...")
embedder = SentenceTransformer('all-MiniLM-L6-v2') # Lightweight, fast, 384-dim embeddings

# --- INITIALIZE FAISS (In-memory vector database) ---
# 384 is the dimension of the embeddings from 'all-MiniLM-L6-v2'
dimension = 384
index = faiss.IndexFlatL2(dimension)
doc_id_map = {} # Maps FAISS index position to MongoDB doc_id

# --- CONFIGURE GEMINI ---
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
llm = genai.GenerativeModel('gemini-pro')

# --- MONGO CONNECTION ---
mongo_client = MongoClient(os.getenv("MONGO_URI", "mongodb://mongo_db:27017"))
db = mongo_client.hydra_docs
documents_collection = db.documents

@app.post("/ocr")
async def process_ocr(
    file: UploadFile = File(...),
    x_user_id: str = Header(...)
):
    # 1. Read the image bytes
    image_bytes = await file.read()
    
    # 2. Extract text using EasyOCR
    # EasyOCR returns a list of tuples: (bbox, text, confidence)
    results = ocr_reader.readtext(image_bytes, detail=0)
    extracted_text = " ".join(results)
    
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No text found in image")

    # 3. Store the OCR result in MongoDB
    doc_data = {
        "title": f"OCR: {file.filename}",
        "filename": file.filename,
        "content": extracted_text,
        "user_id": int(x_user_id),
        "type": "ocr"
    }
    result = documents_collection.insert_one(doc_data)
    doc_id = str(result.inserted_id)

    # 4. Embed the text and add to FAISS
    embedding = embedder.encode([extracted_text])[0]
    index.add(np.array([embedding]).astype('float32'))
    doc_id_map[index.ntotal - 1] = doc_id

    return {"id": doc_id, "extracted_text": extracted_text}

@app.post("/rag-query")
async def rag_query(
    query: str,
    x_user_id: str = Header(...)
):
    # 1. Embed the user's query
    query_embedding = embedder.encode([query])[0].astype('float32')

    # 2. Search FAISS for the top 3 most similar documents
    k = 3
    distances, indices = index.search(np.array([query_embedding]), k)

    # 3. Retrieve the actual text from MongoDB using the doc_id_map
    retrieved_docs = []
    for i in indices[0]:
        if i != -1 and i in doc_id_map:
            doc_id = doc_id_map[i]
            # In a real app, you'd query MongoDB here. For speed, we'll just return the index.
            retrieved_docs.append(f"Document {doc_id} matched.")

    # 4. Construct the RAG prompt
    context = "\n".join(retrieved_docs)
    prompt = f"""
    You are a helpful assistant. Use the following context to answer the user's question.
    If the answer is not in the context, say "I don't know."
    
    Context: {context}
    Question: {query}
    Answer:
    """

    # 5. Generate the answer using Gemini
    response = llm.generate_content(prompt)
    
    return {
        "query": query,
        "answer": response.text,
        "sources": retrieved_docs
    }