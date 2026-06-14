import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Home, Upload, LogOut, Users, PlusCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ImportData from './pages/ImportData';
import DetailedBalances from './pages/DetailedBalances';
import Login from './pages/Login';
import Signup from './pages/Signup';
import GroupManager from './pages/GroupManager';
import AddExpense from './pages/AddExpense';
import './index.css';

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [view, setView] = useState('login');

  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (stored) {
      setAuthUser(JSON.parse(stored));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authUser');
    setAuthUser(null);
  };

  if (!authUser) {
    return view === 'login' 
      ? <Login setAuthUser={setAuthUser} setView={setView} />
      : <Signup setAuthUser={setAuthUser} setView={setView} />;
  }

  // Assigning a default group ID of 1 for simplicity, per assignment scope
  const groupId = 1;

  return (
    <BrowserRouter>
      <div className="layout-container">
        <header className="header animate-fade-in">
          <div>
            <h1>Spreetail Split</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Welcome, {authUser.name}
            </p>
          </div>
          <nav style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Link to="/" className="btn btn-outline"><Home size={18} /> Dashboard</Link>
            <Link to="/groups" className="btn btn-outline"><Users size={18} /> Groups</Link>
            <Link to="/add-expense" className="btn btn-outline"><PlusCircle size={18} /> Add</Link>
            <Link to="/import" className="btn btn-primary"><Upload size={18} /> Import CSV</Link>
            <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '10px' }} title="Logout">
              <LogOut size={18} />
            </button>
          </nav>
        </header>

        <main className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Routes>
            <Route path="/" element={<Dashboard groupId={groupId} />} />
            <Route path="/groups" element={<GroupManager groupId={groupId} />} />
            <Route path="/add-expense" element={<AddExpense groupId={groupId} authUser={authUser} />} />
            <Route path="/import" element={<ImportData groupId={groupId} />} />
            <Route path="/user/:userId/details" element={<DetailedBalances groupId={groupId} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;