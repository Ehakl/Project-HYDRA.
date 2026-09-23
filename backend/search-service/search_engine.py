import sqlite3
import os
import re

DB_PATH = os.path.join(os.path.dirname(__file__), 'search.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Allows us to access columns by name (like dicts)
    return conn

def init_db():
    """Creates the SQLite table and indexes if they don't exist."""
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # We create an index on the title for faster lookups.
        conn.execute('CREATE INDEX IF NOT EXISTS idx_title ON documents(title)')

def clean_text(text):
    """Strips out punctuation and converts to lowercase for better matching."""
    if not text:
        return ""
    return re.sub(r'[^\w\s]', '', text.lower())

def index_document(doc_id, title, content):
    """Inserts or updates a document in the search index."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO documents (doc_id, title, content) VALUES (?, ?, ?)",
            (doc_id, title, content or '')
        )
        conn.commit()

def search_documents(query):
    """Performs a basic keyword search (LIKE query)."""
    if not query:
        return []
    
    # Clean the user's search query
    clean_query = clean_text(query)
    
    with get_db() as conn:
        # We search both the title and content.
        # The % around the query are SQL wildcards.
        cur = conn.execute(
            "SELECT doc_id, title, content FROM documents WHERE title LIKE ? OR content LIKE ? LIMIT 20",
            (f'%{clean_query}%', f'%{clean_query}%')
        )
        results = []
        for row in cur:
            results.append({
                "doc_id": row["doc_id"],
                "title": row["title"],
                "snippet": row["content"][:150] + "..." if len(row["content"]) > 150 else row["content"]
            })
        return results