import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import AIDashboard from './AIDashboard';

const RECORD_TYPES = [
  { value: 'lab_report', label: 'Laboratory report' },
  { value: 'chain_of_custody', label: 'Chain of custody' },
  { value: 'field_notes', label: 'Field notes' },
  { value: 'calibration_record', label: 'Calibration record' },
  { value: 'other', label: 'Other evidence' },
];

const REQUIRED_EVIDENCE = ['chain_of_custody', 'lab_report'];
const RECORD_LABELS = Object.fromEntries(RECORD_TYPES.map(({ value, label }) => [value, label]));

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [recordType, setRecordType] = useState('lab_report');
  const [sampleId, setSampleId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef(null);

  const samples = useMemo(() => {
    const byId = new Map();
    docs.forEach((document) => {
      if (!document.sample_id) return;
      const sample = byId.get(document.sample_id) || {
        id: document.sample_id,
        site: document.site_name || 'Site not recorded',
        records: new Set(),
        count: 0,
      };
      sample.records.add(document.record_type || 'other');
      sample.count += 1;
      if (sample.site === 'Site not recorded' && document.site_name) sample.site = document.site_name;
      byId.set(document.sample_id, sample);
    });
    return Array.from(byId.values()).map((sample) => ({
      ...sample,
      missing: REQUIRED_EVIDENCE.filter((type) => !sample.records.has(type)),
    }));
  }, [docs]);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setWorkspaceError('');
    setIsLoading(true);
    try {
      const response = await api.get('/docs/documents');
      setDocs(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setWorkspaceError(error.response?.data?.detail || 'The evidence register could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file || !title.trim()) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('record_type', recordType);
    formData.append('sample_id', sampleId.trim());
    formData.append('site_name', siteName.trim());

    setIsUploading(true);
    setWorkspaceError('');
    setNotice('');
    try {
      await api.post('/docs/documents', formData);
      setTitle('');
      setSampleId('');
      setSiteName('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice('Evidence added to the register.');
      await fetchDocs();
    } catch (error) {
      setWorkspaceError(error.response?.data?.detail || 'Upload failed. Check the file and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('Enter a sample ID, analyte, site, or phrase to search.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const response = await api.get('/search', { params: { q: query } });
      setSearchResults(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setSearchError(error.response?.data?.error || 'Search is unavailable. Your records are unchanged.');
    } finally {
      setIsSearching(false);
    }
  };

  const completedSamples = samples.filter((sample) => sample.missing.length === 0).length;
  const today = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());

  return (
    <div className="dashboard lab-dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">Environmental sample operations</span>
          <h1>Evidence, in order.</h1>
          <p>Connect field custody to lab results before a sample packet leaves the bench.</p>
        </div>
        <div className="desk-date"><span className="status-dot" /> FIELD DESK <b>{today}</b></div>
      </div>

      {workspaceError && <p className="workspace-error" role="alert">{workspaceError}</p>}
      {notice && <p className="workspace-notice" role="status">{notice}</p>}

      <section className="metrics-row" aria-label="Evidence overview">
        <div className="metric-card"><span>Evidence records</span><strong>{isLoading ? '—' : docs.length}</strong><small>Uploaded to this workspace</small></div>
        <div className="metric-card accent"><span>Samples tracked</span><strong>{isLoading ? '—' : samples.length}</strong><small>Records linked by sample ID</small></div>
        <div className="metric-card"><span>Core pairs present</span><strong>{isLoading ? '—' : `${completedSamples} / ${samples.length}`}</strong><small>Custody record + lab report</small></div>
      </section>

      <section className="workspace-grid desk-workspace-grid">
        <div className="panel upload-panel">
          <div className="panel-heading"><div><span className="panel-kicker">01 / Intake</span><h3>Log evidence</h3></div><span className="panel-icon">+</span></div>
          <p>Attach a report to its sample and collection site.</p>
          <form onSubmit={handleUpload}>
            <label className="field-label" htmlFor="evidence-title">Record title</label>
            <input id="evidence-title" type="text" placeholder="e.g. VOC analysis, bottle set 04" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required />
            <div className="field-pair">
              <label className="field-label" htmlFor="record-type">Evidence type
                <select id="record-type" value={recordType} onChange={(event) => setRecordType(event.target.value)}>
                  {RECORD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className="field-label" htmlFor="sample-id">Sample ID <span>optional</span>
                <input id="sample-id" type="text" placeholder="e.g. GW-24-018" value={sampleId} onChange={(event) => setSampleId(event.target.value)} maxLength={80} />
              </label>
            </div>
            <label className="field-label" htmlFor="site-name">Site / location <span>optional</span>
              <input id="site-name" type="text" placeholder="e.g. North well, transect B" value={siteName} onChange={(event) => setSiteName(event.target.value)} maxLength={120} />
            </label>
            <label className="field-label" htmlFor="evidence-file">File <span>text, CSV, or searchable PDF</span>
              <input ref={fileInputRef} id="evidence-file" type="file" accept=".txt,.csv,.tsv,.json,.pdf,text/plain,text/csv,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
            </label>
            <button className="primary-button" type="submit" disabled={isUploading || !file}>
              {isUploading ? 'Indexing evidence…' : 'Add to register'} <span aria-hidden="true">-&gt;</span>
            </button>
          </form>
        </div>

        <div className="panel search-panel">
          <div className="panel-heading"><div><span className="panel-kicker">02 / Retrieval</span><h3>Find a result</h3></div><span className="panel-icon">/</span></div>
          <p>Search your own reports, field notes, and sample references.</p>
          <form className="search-input-row" onSubmit={handleSearch}>
            <input type="search" aria-label="Search evidence" placeholder="Analyte, sample ID, site…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            <button className="icon-button" type="submit" aria-label="Run evidence search" disabled={isSearching}>{isSearching ? '…' : '-&gt;'}</button>
          </form>
          {searchError && <p className="inline-error" role="alert">{searchError}</p>}
          <div className="search-results" aria-live="polite">
            {searchResults.length === 0 && !searchError && <span className="empty-state">Matching evidence will appear here.</span>}
            {searchResults.map((result) => (
              <article className="search-result" key={result.doc_id}>
                <strong>{result.title}</strong>
                <p>{result.snippet}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel coverage-panel">
        <div className="panel-heading">
          <div><span className="panel-kicker">03 / Sample register</span><h3>Evidence coverage</h3></div>
          <span className="count-label">{samples.length} linked samples</span>
        </div>
        <p className="coverage-note">A record-pair check only; it is not a regulatory compliance determination.</p>
        {isLoading ? <p className="empty-state">Loading sample records…</p> : samples.length === 0 ? (
          <div className="register-empty"><span className="register-empty-mark">01</span><div><strong>No sample IDs linked yet</strong><p>Add a sample ID while logging custody records and lab results to build the register.</p></div></div>
        ) : (
          <div className="table-scroll">
            <table className="sample-table">
              <thead><tr><th>Sample</th><th>Site</th><th>Evidence on file</th><th>Next record</th></tr></thead>
              <tbody>
                {samples.map((sample) => (
                  <tr key={sample.id}>
                    <td><strong className="sample-code">{sample.id}</strong><small>{sample.count} {sample.count === 1 ? 'record' : 'records'}</small></td>
                    <td>{sample.site}</td>
                    <td><div className="record-tags">{Array.from(sample.records).map((type) => <span className="record-tag" key={type}>{RECORD_LABELS[type] || 'Other evidence'}</span>)}</div></td>
                    <td>{sample.missing.length === 0 ? <span className="coverage-complete">Core pair present</span> : <span className="coverage-gap">Add {sample.missing.map((type) => RECORD_LABELS[type].toLowerCase()).join(' + ')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel docs-panel">
        <div className="panel-heading"><div><span className="panel-kicker">04 / Evidence library</span><h3>Recently added</h3></div><span className="count-label">{docs.length} records</span></div>
        <ul>
          {!isLoading && docs.length === 0 && <li className="empty-state">No evidence records have been added.</li>}
          {docs.map((document) => (
            <li key={document.id}>
              <span className="file-badge">{(RECORD_LABELS[document.record_type] || 'DOC').slice(0, 3).toUpperCase()}</span>
              <span className="document-row-main"><strong>{document.title}</strong><small>{document.filename || 'Extracted record'}{document.sample_id ? ` · ${document.sample_id}` : ''}{document.site_name ? ` · ${document.site_name}` : ''}</small></span>
              <span className="document-type">{RECORD_LABELS[document.record_type] || 'Other evidence'}</span>
            </li>
          ))}
        </ul>
      </section>

      <AIDashboard onEvidenceAdded={fetchDocs} />
    </div>
  );
}