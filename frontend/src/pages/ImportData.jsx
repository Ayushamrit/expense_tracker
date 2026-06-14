import { useState } from 'react';
import axios from 'axios';
import API from '../api';
import { UploadCloud, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ImportData({ groupId }) {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/import/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReport(res.data.report);
    } catch (err) {
      console.error(err);
      alert("Failed to process CSV.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!report) return;
    setImporting(true);
    try {
      await axios.post(`${API}/api/expenses/group/${groupId}/import`, {
        expenses: report.data_preview
      });
      alert("Data successfully imported!");
      navigate('/');
    } catch (err) {
      console.error(err);
      alert("Failed to save data to database.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in">
      <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <UploadCloud size={24} color="var(--accent-color)" /> Import Expenses
      </h2>

      {!report && (
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select CSV File</label>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !file}>
            {loading ? 'Processing...' : 'Analyze CSV'}
          </button>
        </form>
      )}

      {report && (
        <div className="animate-fade-in" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3>Analysis Report (Meera's View)</h3>
            <button onClick={handleImport} className="btn btn-primary" disabled={importing}>
              {importing ? 'Saving...' : <><Save size={16} /> Approve & Save Data</>}
            </button>
          </div>

          <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px' }}>
            <p><strong>Processed Rows:</strong> {report.total_rows_processed}</p>
            <p><strong>Anomalies Detected & Handled:</strong> {report.anomalies.length}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
              Review the automated fixes below. By clicking "Approve & Save", you confirm these changes.
            </p>
          </div>

          <h4>Anomaly Log</h4>
          <div className="table-container" style={{ marginTop: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Issue</th>
                  <th>Original Value</th>
                  <th>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {report.anomalies.map((anom, idx) => (
                  <tr key={idx}>
                    <td>{anom.row}</td>
                    <td>
                      <span className={`badge ${anom.action === 'skip' ? 'badge-danger' : anom.action === 'review' ? 'badge-warning' : 'badge-warning'}`}>
                        {anom.issue}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{anom.original || '-'}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: anom.action === 'skip' ? 'var(--danger)' : 'var(--success)' }}>
                        {anom.action === 'skip' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />} 
                        {anom.resolution}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
