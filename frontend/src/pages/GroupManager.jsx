import { useState, useEffect } from 'react';
import axios from 'axios';
import API from '../api';
import { Users, UserPlus, Calendar, LogOut, Info } from 'lucide-react';

export default function GroupManager({ groupId }) {
  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API}/api/groups/${groupId}/members`);
      setMembers(res.data);
      
      const resBalances = await axios.get(`${API}/api/balances/group/${groupId}`);
      setBalances(resBalances.data.balances);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    try {
      await axios.post(`${API}/api/groups/${groupId}/members`, {
        name: newMemberName.trim(),
        joined_at: joinDate
      });
      setNewMemberName('');
      fetchMembers();
    } catch (err) {
      console.error(err);
      alert("Failed to add member");
    }
  };

  const handleLeaveGroup = async (userId) => {
    if (!window.confirm("Are you sure you want to mark this member as left? They will no longer be included in active splits.")) return;
    try {
      await axios.put(`${API}/api/groups/${groupId}/members/${userId}/leave`);
      fetchMembers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to leave group");
    }
  };

  const handleShowSummary = (userId, name) => {
    const userBalance = balances.find(b => b.user_id == userId);
    if (!userBalance) {
      alert(`No balance data found for ${name}.`);
      return;
    }
    alert(`Overall Dues Summary for ${name}:\n\nTotal Paid (Gets): ₹${userBalance.total_paid}\nTotal Owed: ₹${userBalance.total_owed}\nNet Balance: ₹${userBalance.net_balance}`);
  };

  if (loading) return <div className="glass-panel" style={{ textAlign: 'center' }}>Loading members...</div>;

  return (
    <div className="animate-fade-in">
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={24} color="var(--accent-color)" /> Add New Member
        </h2>
        <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Name</label>
            <input 
              type="text" 
              placeholder="e.g. Sam" 
              value={newMemberName} 
              onChange={(e) => setNewMemberName(e.target.value)} 
              required 
              style={{ marginBottom: 0 }}
            />
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Joined Date</label>
            <input 
              type="date" 
              value={joinDate} 
              onChange={(e) => setJoinDate(e.target.value)} 
              required 
              style={{ marginBottom: 0 }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>Add to Group</button>
        </form>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '12px' }}>
          Setting the Joined Date ensures this member isn't accidentally charged for expenses before they moved in.
        </p>
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} color="var(--accent-color)" /> Current & Past Members
        </h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Left Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isPast = m.left_at !== null && new Date(m.left_at) < new Date();
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: '500', color: isPast ? 'var(--text-secondary)' : 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.name}
                      <Info size={16} color="var(--accent-color)" style={{ cursor: 'pointer' }} onClick={() => handleShowSummary(m.id, m.name)} title="View Summary" />
                    </td>
                    <td>
                      {isPast ? 
                        <span className="badge badge-warning">Inactive</span> : 
                        <span className="badge badge-success">Active</span>
                      }
                    </td>
                    <td><Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: 'var(--text-secondary)' }}/>{new Date(m.joined_at).toLocaleDateString()}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.left_at ? new Date(m.left_at).toLocaleDateString() : '-'}</td>
                    <td>
                      {!isPast && (
                        <button 
                          onClick={() => handleLeaveGroup(m.id)}
                          className="btn btn-outline" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <LogOut size={14} /> Leave
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
