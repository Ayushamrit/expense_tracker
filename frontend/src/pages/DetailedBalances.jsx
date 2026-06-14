import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import API from '../api';
import { ArrowLeft, FileText } from 'lucide-react';

export default function DetailedBalances({ groupId }) {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalances();
  }, [groupId]);

  const fetchBalances = async () => {
    try {
      const res = await axios.get(`${API}/api/balances/group/${groupId}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="glass-panel" style={{ textAlign: 'center' }}>Loading details...</div>;
  if (!data) return <div className="glass-panel" style={{ textAlign: 'center' }}>No data available.</div>;

  const user = data.balances.find(b => b.user_id == userId);
  const detailedDebts = data.detailed_debts[userId] || [];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <Link to="/" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h2>{user?.name}'s Balance Details (Rohan's View)</h2>
        <div style={{ fontSize: '2rem', fontWeight: '600', marginTop: '8px' }} className={Number(user?.net_balance) > 0 ? 'amount-positive' : Number(user?.net_balance) < 0 ? 'amount-negative' : ''}>
          {Number(user?.net_balance) > 0 ? '+' : ''}₹{Math.abs(user?.net_balance)}
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          "No magic numbers." Here is exactly what expenses make up this balance.
        </p>
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} color="var(--accent-color)" /> Exact Expense Breakdown
        </h3>
        
        {detailedDebts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No specific debts found for this user.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense Description</th>
                  <th>Owed To</th>
                  <th>Amount Share</th>
                </tr>
              </thead>
              <tbody>
                {detailedDebts.map((debt, idx) => {
                  const owedToName = data.balances.find(b => b.user_id == debt.owed_to)?.name || 'Unknown';
                  return (
                    <tr key={idx}>
                      <td>{new Date(debt.date).toLocaleDateString()}</td>
                      <td>{debt.description}</td>
                      <td>{owedToName}</td>
                      <td className="amount-negative">₹{debt.amount.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
