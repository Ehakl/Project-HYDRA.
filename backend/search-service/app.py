from flask import Flask, request, jsonify
from search_engine import init_db, index_document, search_documents
import os

app = Flask(__name__)

# Initialize the SQLite database on startup
init_db()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "OK"}), 200

# --- INDEX ENDPOINT (Called by FastAPI) ---
@app.route('/index', methods=['POST'])
def index():
    # FastAPI sends us JSON data
    data = request.json
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    doc_id = data.get('doc_id')
    title = data.get('title')
    content = data.get('content')
    try:
        user_id = int(request.headers.get('x-user-id', ''))
    except ValueError:
        return jsonify({"error": "A valid user identity is required"}), 401

    if not doc_id or not title:
        return jsonify({"error": "doc_id and title are required"}), 400

    # Insert into SQLite
    index_document(doc_id, title, content, user_id)
    return jsonify({"status": "indexed", "doc_id": doc_id}), 201

# --- SEARCH ENDPOINT (Called by React via Gateway) ---
@app.route('/', methods=['GET'])
@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    try:
        user_id = int(request.headers.get('x-user-id', ''))
    except ValueError:
        return jsonify({"error": "A valid user identity is required"}), 401
    if not query:
        return jsonify([])
    
    results = search_documents(query, user_id)
    return jsonify(results)

if __name__ == '__main__':
    # Inside Docker, we listen on 0.0.0.0 so the Gateway can reach us.
    app.run(host='0.0.0.0', port=5001, debug=True)