import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userObj = await login({ email, password });
      
      const role = userObj.role;
      const status = userObj.status || (userObj.approved ? 'ACTIVE' : 'PENDING');

      // Admin bypasses pending check
      if (role === 'ADMIN') {
        navigate('/admin/dashboard');
        return;
      }

      // If status is PENDING, REJECTED, or SUSPENDED, route to /application-pending
      if (status !== 'ACTIVE') {
        navigate('/application-pending');
        return;
      }

      // Route to active operational dashboards
      if (role === 'RESTAURANT' || role === 'RESTAURANT_OWNER') {
        navigate('/restaurant/dashboard');
      } else if (role === 'DELIVERY_PARTNER') {
        navigate('/delivery/dashboard');
      } else if (role === 'NGO') {
        navigate('/ngo/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '480px', marginTop: '3.5rem', marginBottom: '4rem' }}>
      <div className="card" style={{ borderColor: 'rgba(255, 94, 58, 0.4)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', textAlign: 'center', marginBottom: '0.5rem' }}>Sign In to SmartEats</h2>
        <p style={{ color: 'var(--text-sub)', textAlign: 'center', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Access your role-based portal via API Gateway
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@smarteats.com"
              style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }}
            />
          </div>

          <button type="submit" className="btn-action" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
