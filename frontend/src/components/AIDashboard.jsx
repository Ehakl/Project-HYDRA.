import { useRef, useState } from 'react';
import api from '../api';

export default function AIDashboard({ onEvidenceAdded }) {
  const [file, setFile] = useState(null);
  const [sampleId, setSampleId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [extractionResult, setExtractionResult] = useState('');
  const [extractionError, setExtractionError] = useState('');
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [assistantResult, setAssistantResult] = useState('');
  const [assistantSources, setAssistantSources] = useState([]);
  const [assistantError, setAssistantError] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (event) => {
    event.preventDefault();
    if (!file) return;
    setExtractionLoading(true);
    setExtractionError('');
    setExtractionResult('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/ai/extract', formData);
      setExtractionResult(response.data.extracted_text);
      setSaveError('');
    } catch (error) {
      setExtractionError(error.response?.data?.detail || 'The scan could not be processed.');
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleSaveExtraction = async () => {
    const fileStem = (file?.name || 'field-sheet').replace(/\.[^.]+$/, '').slice(0, 150);
    const extractedFile = new File([extractionResult], `${fileStem}-extracted.txt`, { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', extractedFile);
    formData.append('title', `Field notes: ${fileStem}`.slice(0, 180));
    formData.append('record_type', 'field_notes');
    formData.append('sample_id', sampleId.trim());
    formData.append('site_name', siteName.trim());

    setSaveLoading(true);
    setSaveError('');
    try {
      await api.post('/docs/documents', formData);
      setExtractionResult('');
      setFile(null);
      setSampleId('');
      setSiteName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onEvidenceAdded();
    } catch (error) {
      setSaveError(error.response?.data?.detail || 'The extracted record could not be saved.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAssistantQuery = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setAssistantLoading(true);
    setAssistantError('');
    setAssistantResult('');
    setAssistantSources([]);

    try {
      const response = await api.post('/ai/assistant-query', null, { params: { query: query.trim() } });
      setAssistantResult(response.data.answer);
      setAssistantSources(response.data.sources || []);
    } catch (error) {
      setAssistantError(error.response?.data?.detail || 'The document assistant is unavailable.');
      setAssistantSources(error.response?.data?.sources || []);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <section className="ai-dashboard" aria-labelledby="evidence-tools-title">
      <div className="ai-section-heading">
        <div><span className="panel-kicker">05 / Review tools</span><h2 id="evidence-tools-title">Read the field sheet. Question the record.</h2></div>
        <span className="ai-mark" aria-hidden="true">AI / LAB</span>
      </div>

      <div className="ocr-section">
        <span className="tool-index">A / SCAN</span>
        <h3>Capture a field sheet</h3>
        <p>Extract a field photo, review the text, then add it to the evidence register.</p>
        <form onSubmit={handleImageUpload}>
          <label className="field-label" htmlFor="scan-sample">Sample ID <span>optional</span>
            <input id="scan-sample" type="text" placeholder="e.g. GW-24-018" value={sampleId} onChange={(event) => setSampleId(event.target.value)} maxLength={80} />
          </label>
          <label className="field-label" htmlFor="scan-site">Site / location <span>optional</span>
            <input id="scan-site" type="text" placeholder="e.g. North well" value={siteName} onChange={(event) => setSiteName(event.target.value)} maxLength={120} />
          </label>
          <label className="field-label" htmlFor="scan-file">Image file
            <input ref={fileInputRef} id="scan-file" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
          </label>
          <button type="submit" disabled={extractionLoading || !file}>
            {extractionLoading ? 'Extracting and indexing…' : 'Extract field notes'}
          </button>
        </form>
        {extractionError && <p className="inline-error" role="alert">{extractionError}</p>}
        {extractionResult && <div className="result-box"><strong>Review extracted text</strong><pre>{extractionResult}</pre><button className="save-extraction-button" type="button" onClick={handleSaveExtraction} disabled={saveLoading}>{saveLoading ? 'Saving evidence…' : 'Save as field notes'}</button></div>}
        {saveError && <p className="inline-error" role="alert">{saveError}</p>}
      </div>

      <div className="rag-section">
        <span className="tool-index">B / EVIDENCE Q&amp;A</span>
        <h3>Ask across your records</h3>
        <p>Answers use this workspace’s evidence and return source records for review.</p>
        <form onSubmit={handleAssistantQuery}>
          <label className="field-label" htmlFor="evidence-question">Question
            <input id="evidence-question" type="text" placeholder="What was reported for sample GW-24-018?" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={1000} required />
          </label>
          <button type="submit" disabled={assistantLoading || query.trim().length < 2}>
            {assistantLoading ? 'Reviewing evidence…' : 'Ask the records'}
          </button>
        </form>
        {assistantError && <p className="inline-error" role="alert">{assistantError}</p>}
        {assistantResult && (
          <div className="result-box" aria-live="polite">
            <strong>Evidence-based answer</strong>
            <p className="assistant-answer">{assistantResult}</p>
            {assistantSources.length > 0 && <ul className="source-list">
              {assistantSources.map((source) => (
                <li key={source.id}><b>[{source.label}]</b><span>{source.title}<small>{[source.sample_id, source.site_name, source.record_type?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</small>{source.excerpt && <p className="source-excerpt">{source.excerpt}</p>}</span></li>
              ))}
            </ul>}
          </div>
        )}
      </div>
    </section>
  );
}