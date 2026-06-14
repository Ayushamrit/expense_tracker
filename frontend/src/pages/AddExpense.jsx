import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '../api';
import { PlusCircle, CreditCard } from 'lucide-react';

export default function AddExpense({ groupId, authUser }) {
  const [members, setMembers] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [type, setType] = useState('expense'); 
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [paidBy, setPaidBy] = useState(''); // New: who paid
  const [splitType, setSplitType] = useState('equal');
  const [selectedSplitMembers, setSelectedSplitMembers] = useState({}); // New: who to split with
  const [shares, setShares] = useState({});
  const [paidTo, setPaidTo] = useState(''); // for settlement
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API}/api/groups/${groupId}/members`);
      setMembers(res.data);
      
      const active = res.data.filter(m => !m.left_at || new Date(m.left_at) > new Date());
      setActiveMembers(active);
      
      if (active.length > 0) {
        setPaidBy(authUser?.id?.toString() || active[0].id.toString());
        setPaidTo(active.find(m => m.id !== authUser?.id)?.id?.toString() || active[0].id.toString());
      }

      // Default select all active members for splitting
      const initialSelected = {};
      active.forEach(m => initialSelected[m.id] = true);
      setSelectedSplitMembers(initialSelected);

    } catch (err) {
      console.error(err);
    }
  };

  const handleShareChange = (userId, val) => {
    setShares(prev => ({ ...prev, [userId]: val }));
  };

  const handleMemberSelectToggle = (userId) => {
    setSelectedSplitMembers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (type === 'settlement') {
        const settlementData = [{
          description: "Settlement",
          amount: amount,
          currency: currency,
          date: date,
          paid_by: authUser.name,
          split_type: 'settlement',
          split_with: activeMembers.find(m => m.id == paidTo)?.name
        }];
        await axios.post(`${API}/api/expenses/group/${groupId}/import`, { expenses: settlementData });
      } else {
        const total = parseFloat(amount);
        let calculatedSplits = [];
        
        const splitMembersList = activeMembers.filter(m => selectedSplitMembers[m.id]);
        
        if (splitMembersList.length === 0) {
            alert("Please select at least one member to split with.");
            setLoading(false);
            return;
        }

        if (splitType === 'equal') {
           const perPerson = total / splitMembersList.length;
           calculatedSplits = splitMembersList.map(m => ({ user_id: m.id, amount_owed: perPerson }));
        } else if (splitType === 'percentage') {
           let totalPercent = 0;
           splitMembersList.forEach(m => totalPercent += parseFloat(shares[m.id] || 0));
           if (Math.abs(totalPercent - 100) > 0.01) {
               alert(`Percentages must sum to 100%. Currently they sum to ${totalPercent}%`);
               setLoading(false);
               return;
           }
           calculatedSplits = splitMembersList.map(m => ({ 
             user_id: m.id, 
             amount_owed: total * (parseFloat(shares[m.id] || 0) / 100) 
           }));
        } else if (splitType === 'share') {
           let totalShares = 0;
           splitMembersList.forEach(m => totalShares += parseFloat(shares[m.id] || 0));
           calculatedSplits = splitMembersList.map(m => ({ 
             user_id: m.id, 
             amount_owed: total * (parseFloat(shares[m.id] || 0) / totalShares) 
           }));
        } else if (splitType === 'unequal') {
           let totalExact = 0;
           splitMembersList.forEach(m => totalExact += parseFloat(shares[m.id] || 0));
           if (Math.abs(totalExact - total) > 0.01) {
               alert(`Exact amounts must sum to ${total}. Currently they sum to ${totalExact}`);
               setLoading(false);
               return;
           }
           calculatedSplits = splitMembersList.map(m => ({ 
             user_id: m.id, 
             amount_owed: parseFloat(shares[m.id] || 0) 
           }));
        }

        await axios.post(`${API}/api/expenses/group/${groupId}`, {
          description,
          amount,
          currency,
          date,
          paid_by: paidBy,
          split_type: splitType,
          splits: calculatedSplits
        });
      }
      
      alert("Success!");
      navigate('/');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          type="button"
          className={`btn ${type === 'expense' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setType('expense')}
          style={{ flex: 1 }}
        >
          <PlusCircle size={18} /> Add Expense
        </button>
        <button 
          type="button"
          className={`btn ${type === 'settlement' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setType('settlement')}
          style={{ flex: 1 }}
        >
          <CreditCard size={18} /> Settle Debt
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {type === 'expense' ? (
          <>
            <input type="text" placeholder="Description (e.g. Dinner)" value={description} onChange={e => setDescription(e.target.value)} required />
            <div style={{ display: 'flex', gap: '16px' }}>
              <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} required style={{ flex: 2 }} />
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ flex: 1 }}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            
            <label style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Who Paid?</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} required>
              {activeMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name} {m.id === authUser?.id ? '(You)' : ''}</option>
              ))}
            </select>

            <label style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Split With (Select Members)</label>
            <div style={{ position: 'relative' }}>
              <button 
                type="button" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'inherit', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{Object.values(selectedSplitMembers).filter(Boolean).length} members selected</span>
                <span>{dropdownOpen ? '▲' : '▼'}</span>
              </button>
              {dropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' }}>
                  {activeMembers.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0' }}>
                      <input 
                        type="checkbox" 
                        checked={!!selectedSplitMembers[m.id]} 
                        onChange={() => handleMemberSelectToggle(m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>How to Split</label>
            <select value={splitType} onChange={e => setSplitType(e.target.value)}>
              <option value="equal">Equally among selected</option>
              <option value="percentage">By Percentage</option>
              <option value="share">By Shares</option>
              <option value="unequal">Exact Amounts (Unequal)</option>
            </select>

            {splitType !== 'equal' && (
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '12px' }}>Assign {splitType === 'percentage' ? 'Percentages' : splitType === 'share' ? 'Shares' : 'Exact Amounts'}</h4>
                {activeMembers.filter(m => selectedSplitMembers[m.id]).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>{m.name}</span>
                    <input 
                      type="number" 
                      style={{ width: '120px', marginBottom: 0 }} 
                      value={shares[m.id] || ''}
                      onChange={(e) => handleShareChange(m.id, e.target.value)}
                      placeholder={splitType === 'percentage' ? '%' : '0'}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h3 style={{ marginBottom: '8px' }}>You are paying:</h3>
            <select value={paidTo} onChange={e => setPaidTo(e.target.value)} required>
              {activeMembers.filter(m => m.id !== authUser.id).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '16px' }}>
              <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} required style={{ flex: 2 }} />
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ flex: 1 }}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '16px' }}>
          {loading ? 'Saving...' : type === 'expense' ? 'Save Expense' : 'Record Payment'}
        </button>
      </form>
    </div>
  );
}
