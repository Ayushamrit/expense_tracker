import { useState } from 'react';
import axios from 'axios';
import API from '../api';

export default function Signup({ setAuthUser, setView }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/users/signup`, { name, email, password });
      setAuthUser(res.data);
      localStorage.setItem('authUser', JSON.stringify(res.data));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '8px' }}>Create an Account</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Join Spreetail Split</p>
        
        <form onSubmit={handleSignup}>
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ marginBottom: '16px' }} />
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: '16px' }} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginBottom: '24px' }} />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>
        <p style={{ marginTop: '16px', fontSize: '0.9rem' }}>
          Already have an account? <span style={{ color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setView('login')}>Sign In</span>
        </p>
      </div>
    </div>
  );
}
