import { useState } from 'react';
import api from '../api';

export default function AIDashboard() {
  const [file, setFile] = useState(null);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  
  const [query, setQuery] = useState('');
  const [ragResult, setRagResult] = useState('');
  const [ragLoading, setRagLoading] = useState(false);

  const handleOcrUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setOcrLoading(true);
    setOcrResult('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post('/ai/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setOcrResult(res.data.extracted_text);
    } catch (err) {
      setOcrResult('OCR failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRagQuery = async (e) => {
    e.preventDefault();
    if (!query) return;
    setRagLoading(true);
    setRagResult('');
    
    try {
      const res = await api.post(`/ai/rag-query?query=${encodeURIComponent(query)}`);
      setRagResult(res.data.answer);
    } catch (err) {
      setRagResult('RAG failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="ai-dashboard">
      <h2>AI Tools</h2>
      
      {/* OCR Section */}
      <div className="ocr-section">
        <h3>Image OCR</h3>
        <form onSubmit={handleOcrUpload}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <button type="submit" disabled={ocrLoading}>
            {ocrLoading ? 'Extracting...' : 'Extract Text'}
          </button>
        </form>
        {ocrResult && (
          <div className="result-box">
            <strong>Extracted Text:</strong>
            <p>{ocrResult}</p>
          </div>
        )}
      </div>

      {/* RAG Section */}
      <div className="rag-section">
        <h3>Ask Your Documents (RAG)</h3>
        <form onSubmit={handleRagQuery}>
          <input 
            type="text" 
            placeholder="Ask a question about your documents..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            required 
          />
          <button type="submit" disabled={ragLoading}>
            {ragLoading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
        {ragResult && (
          <div className="result-box">
            <strong>Answer:</strong>
            <p>{ragResult}</p>
          </div>
        )}
      </div>
    </div>
  );
}