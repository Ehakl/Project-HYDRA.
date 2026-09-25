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
                user_id INTEGER,
                search_blob TEXT NOT NULL DEFAULT '',
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        columns = {row['name'] for row in conn.execute('PRAGMA table_info(documents)')}
        if 'user_id' not in columns:
            conn.execute('ALTER TABLE documents ADD COLUMN user_id INTEGER')
        if 'search_blob' not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN search_blob TEXT NOT NULL DEFAULT ''")
        legacy_rows = conn.execute(
            "SELECT doc_id, title, content FROM documents WHERE search_blob = ''"
        ).fetchall()
        for row in legacy_rows:
            normalized_text = clean_text(f"{row['title'] or ''} {row['content'] or ''}")
            conn.execute(
                'UPDATE documents SET search_blob = ? WHERE doc_id = ?',
                (normalized_text, row['doc_id'])
            )
        # We create an index on the title for faster lookups.
        conn.execute('CREATE INDEX IF NOT EXISTS idx_title ON documents(title)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_owner_title ON documents(user_id, title)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_owner_search ON documents(user_id, search_blob)')

def clean_text(text):
    """Strips out punctuation and converts to lowercase for better matching."""
    if not text:
        return ""
    return re.sub(r'[^\w\s]', '', text.lower())

def index_document(doc_id, title, content, user_id):
    """Inserts or updates a document in the search index."""
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO documents (doc_id, title, content, user_id, search_blob) VALUES (?, ?, ?, ?, ?)",
            (doc_id, title, content or '', user_id, clean_text(f'{title or ""} {content or ""}'))
        )
        conn.commit()

def search_documents(query, user_id):
    """Performs a basic keyword search (LIKE query)."""
    if not query:
        return []
    
    # Clean the user's search query
    clean_query = clean_text(query)
    if not clean_query:
        return []
    
    with get_db() as conn:
        # Search only this user's documents in both title and content.
        # The % around the query are SQL wildcards.
        cur = conn.execute(
            "SELECT doc_id, title, content FROM documents WHERE user_id = ? AND search_blob LIKE ? LIMIT 20",
            (user_id, f'%{clean_query}%')
        )
        results = []
        for row in cur:
            results.append({
                "doc_id": row["doc_id"],
                "title": row["title"],
                "snippet": row["content"][:150] + "..." if len(row["content"]) > 150 else row["content"]
            })
        return results