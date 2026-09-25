import { useState } from 'react';
import api from '../api';

export default function AIDashboard() {
  const [file, setFile] = useState(null);
  const [extractionResult, setExtractionResult] = useState('');
  const [extractionLoading, setExtractionLoading] = useState(false);
  
  const [query, setQuery] = useState('');
  const [assistantResult, setAssistantResult] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);

  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setExtractionLoading(true);
    setExtractionResult('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post('/ai/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setExtractionResult(res.data.extracted_text);
    } catch (err) {
      setExtractionResult('Unable to process this file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleAssistantQuery = async (e) => {
    e.preventDefault();
    if (!query) return;
    setAssistantLoading(true);
    setAssistantResult('');
    
    try {
      const res = await api.post(`/ai/assistant-query?query=${encodeURIComponent(query)}`);
      setAssistantResult(res.data.answer);
    } catch (err) {
      setAssistantResult('Unable to answer right now: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="ai-dashboard">
      <h2>Smart workspace</h2>
      
      <div className="ocr-section">
        <h3>Extract from an image</h3>
        <form onSubmit={handleImageUpload}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <button type="submit" disabled={extractionLoading}>
            {extractionLoading ? 'Processing...' : 'Extract text'}
          </button>
        </form>
        {extractionResult && (
          <div className="result-box">
            <strong>Extracted content</strong>
            <p>{extractionResult}</p>
          </div>
        )}
      </div>

      <div className="rag-section">
        <h3>Ask your library</h3>
        <form onSubmit={handleAssistantQuery}>
          <input
            type="text" 
            placeholder="Ask a question about your documents..."
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            required 
          />
          <button type="submit" disabled={assistantLoading}>
            {assistantLoading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
        {assistantResult && (
          <div className="result-box">
            <strong>Answer</strong>
            <p>{assistantResult}</p>
          </div>
        )}
      </div>
    </div>
  );
}