import { useState, useEffect } from 'react';
import api from '../api';
import AIDashboard from './AIDashboard';
export default function Dashboard({ notifications }) {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await api.get('/docs/documents');
      setDocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    try {
      await api.post('/docs/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      setTitle('');
      fetchDocs(); // Refresh document list
    } catch (err) {
      alert('Upload failed');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return setSearchResults([]);
    try {
      const res = await api.get(`/search?q=${searchQuery}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard">
      {/* Notifications Panel */}
      <div className="notifications">
        <h3>Live Notifications</h3>
        {notifications.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload}>
        <h3>Upload Document</h3>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
        <button type="submit">Upload</button>
      </form>

      {/* Search Bar */}
      <div className="search">
        <h3>Search Documents</h3>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
        {searchResults.map((r) => (
          <div key={r.doc_id}>
            <strong>{r.title}</strong>
            <p>{r.snippet}</p>
          </div>
        ))}
      </div>

      {/* Document List */}
      <div className="docs">
        <h3>My Documents</h3>
        <ul>
          {docs.map((d) => (
            <li key={d.id}>
              {d.title} - {d.filename}
            </li>
          ))}
        </ul>
      </div>

      <AIDashboard />
    </div>
  );
}