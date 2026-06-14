import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API from '../api';
import { ArrowRight, Activity, DollarSign } from 'lucide-react';

export default function Dashboard({ groupId }) {
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
      console.error("Failed to fetch balances", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="glass-panel" style={{ textAlign: 'center' }}>Loading dashboard...</div>;
  if (!data || data.balances.length === 0) return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
      <h2 style={{ marginBottom: '16px' }}>Welcome to Spreetail Split!</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>It looks like there are no expenses yet.</p>
      <Link to="/import" className="btn btn-primary">Import CSV to Start</Link>
    </div>
  );

  return (
    <div className="grid-layout">
      {/* Balances Summary */}
      <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={24} color="var(--accent-color)" /> Group Balances
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {data.balances.filter(b => !b.left_at || new Date(b.left_at) > new Date()).map(b => (
            <Link to={`/user/${b.user_id}/details`} key={b.user_id} className="glass-panel" style={{ padding: '16px', display: 'block', textDecoration: 'none', background: 'rgba(15, 23, 42, 0.4)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>{b.name}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '600' }} className={Number(b.net_balance) > 0 ? 'amount-positive' : Number(b.net_balance) < 0 ? 'amount-negative' : ''}>
                {Number(b.net_balance) > 0 ? '+' : ''}₹{Math.abs(b.net_balance)}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                {Number(b.net_balance) > 0 ? 'Gets back' : Number(b.net_balance) < 0 ? 'Owes' : 'Settled up'}
              </div>
              <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View Breakdown <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Simplified Debts (Aisha's View) */}
      <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={24} color="var(--accent-color)" /> Simplified Debts (Aisha's View)
        </h2>
        {data.simplified_debts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Everyone is settled up!</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Who Owes</th>
                  <th></th>
                  <th>Who Gets Paid</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.simplified_debts.map((debt, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '500' }}>{debt.from_name}</td>
                    <td><ArrowRight size={16} color="var(--text-secondary)" /></td>
                    <td style={{ fontWeight: '500' }}>{debt.to_name}</td>
                    <td className="amount-positive">₹{debt.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
