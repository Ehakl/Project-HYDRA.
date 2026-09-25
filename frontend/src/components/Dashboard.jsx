import { useState, useEffect } from 'react';
import api from '../api';
import AIDashboard from './AIDashboard';
export default function Dashboard({ notifications }) {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');

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
      setWorkspaceError('');
      await api.post('/docs/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      setTitle('');
      fetchDocs(); // Refresh document list
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || 'Upload failed. Please try again.');
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
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Your document workspace</h1>
          <p>Everything you need to find, understand, and move work forward.</p>
        </div>
        <div className="date-label">LIVE / PRIVATE</div>
      </div>
      {workspaceError && <p className="workspace-error">{workspaceError}</p>}

      <div className="metrics-row">
        <div className="metric-card"><span>Documents</span><strong>{docs.length}</strong><small>In your library</small></div>
        <div className="metric-card accent"><span>Search status</span><strong>Ready</strong><small>Index is available</small></div>
        <div className="metric-card"><span>AI assistant</span><strong>Online</strong><small>Ready for questions</small></div>
      </div>

      <div className="workspace-grid">
        <div className="panel upload-panel">
          <div className="panel-heading"><div><span className="panel-kicker">01 / Library</span><h3>Add a document</h3></div><span className="panel-icon">+</span></div>
          <p>Upload a file and make it searchable across your workspace.</p>
          <form onSubmit={handleUpload}>
            <input type="text" placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
            <button className="primary-button" type="submit">Upload document <span>-&gt;</span></button>
          </form>
        </div>

        <div className="panel search-panel">
          <div className="panel-heading"><div><span className="panel-kicker">02 / Discovery</span><h3>Find something</h3></div><span className="panel-icon">/</span></div>
          <p>Search the indexed content in your document library.</p>
          <div className="search-input-row">
            <input type="text" placeholder="Try a keyword or phrase" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className="icon-button" onClick={handleSearch} aria-label="Search">-&gt;</button>
          </div>
          <div className="search-results">
            {searchResults.length === 0 ? <span className="empty-state">Results will appear here.</span> : searchResults.map((r) => (
              <div key={r.doc_id}><strong>{r.title}</strong><p>{r.snippet}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel docs-panel">
        <div className="panel-heading"><div><span className="panel-kicker">03 / Collection</span><h3>Recent documents</h3></div><span className="count-label">{docs.length} total</span></div>
        <ul>
          {docs.length === 0 && <li className="empty-state">Your uploaded documents will appear here.</li>}
          {docs.map((d) => (
            <li key={d.id}>
              <span className="file-badge">DOC</span><span><strong>{d.title}</strong><small>{d.filename}</small></span>
            </li>
          ))}
        </ul>
      </div>

      <AIDashboard />
    </div>
  );
}