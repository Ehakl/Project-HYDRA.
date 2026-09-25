import os
import sqlite3
import tempfile
import unittest

import search_engine


class SearchTenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = search_engine.DB_PATH
        search_engine.DB_PATH = os.path.join(self.temp_dir.name, 'search.db')
        search_engine.init_db()
        from app import app as search_app
        self.client = search_app.test_client()

    def tearDown(self):
        search_engine.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_search_returns_only_documents_owned_by_requesting_user(self):
        search_engine.index_document('lab-a', 'Water sample', 'benzene detected', 11)
        search_engine.index_document('lab-b', 'Water sample', 'benzene absent', 22)

        results = search_engine.search_documents('benzene', 11)

        self.assertEqual([result['doc_id'] for result in results], ['lab-a'])

    def test_punctuation_only_query_returns_no_matches(self):
        search_engine.index_document('lab-a', 'Water sample', 'benzene detected', 11)

        self.assertEqual(search_engine.search_documents('!!!', 11), [])

    def test_search_normalizes_hyphenated_sample_ids(self):
        search_engine.index_document('lab-a', 'Groundwater report', 'Sample ID: GW-24-018', 11)

        results = search_engine.search_documents('GW-24-018', 11)

        self.assertEqual([result['doc_id'] for result in results], ['lab-a'])

    def test_existing_index_gets_owner_column_without_losing_records(self):
        with sqlite3.connect(search_engine.DB_PATH) as connection:
            connection.execute('DROP TABLE documents')
            connection.execute(
                'CREATE TABLE documents (doc_id TEXT PRIMARY KEY, title TEXT, content TEXT, indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
            )
            connection.execute(
                'INSERT INTO documents (doc_id, title, content) VALUES (?, ?, ?)',
                ('legacy', 'Old report', 'legacy record')
            )

        search_engine.init_db()

        with sqlite3.connect(search_engine.DB_PATH) as connection:
            columns = {row[1] for row in connection.execute('PRAGMA table_info(documents)')}
            count = connection.execute('SELECT COUNT(*) FROM documents').fetchone()[0]
        self.assertIn('user_id', columns)
        self.assertIn('search_blob', columns)
        self.assertEqual(count, 1)

    def test_index_requires_trusted_user_header(self):
        response = self.client.post('/index', json={
            'doc_id': 'unauthorized',
            'title': 'Untrusted record',
            'content': 'private'
        })

        self.assertEqual(response.status_code, 401)

    def test_index_uses_gateway_identity_not_body_identity(self):
        response = self.client.post('/index', json={
            'doc_id': 'owned-record',
            'title': 'Water sample',
            'content': 'benzene result',
            'user_id': 22
        }, headers={'x-user-id': '11'})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(search_engine.search_documents('benzene', 11)), 1)
        self.assertEqual(search_engine.search_documents('benzene', 22), [])

    def test_search_requires_gateway_identity(self):
        response = self.client.get('/search?q=benzene')

        self.assertEqual(response.status_code, 401)

    def test_root_proxy_alias_searches_only_requesting_user(self):
        self.client.post('/index', json={
            'doc_id': 'lab-a', 'title': 'Water result', 'content': 'benzene detected'
        }, headers={'x-user-id': '11'})
        self.client.post('/index', json={
            'doc_id': 'lab-b', 'title': 'Water result', 'content': 'benzene detected'
        }, headers={'x-user-id': '22'})

        response = self.client.get('/?q=benzene', headers={'x-user-id': '11'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['doc_id'] for item in response.get_json()], ['lab-a'])


if __name__ == '__main__':
    unittest.main()