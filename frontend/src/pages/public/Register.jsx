import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const [role, setRole] = useState('CUSTOMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotice('');
    try {
      const backendRoles = [role === 'RESTAURANT' ? 'RESTAURANT_OWNER' : role];
      const userObj = await register({ name, email, password, phone, roles: backendRoles });
      if (userObj.approved) {
        navigate('/customer/dashboard');
      } else {
        setNotice(`Registration Submitted!\n\nYour ${role.replace('_', ' ')} account status is PENDING_APPROVAL. An Administrator must review and approve your application before full operational access is unlocked.`);
      }
    } catch (err) {
      alert(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '520px', marginTop: '3rem' }}>
      <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.4)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', textAlign: 'center', marginBottom: '0.5rem' }}>Join the SmartEats Platform</h2>
        <p style={{ color: 'var(--text-sub)', textAlign: 'center', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Select your ecosystem role to create an account
        </p>

        {notice ? (
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '1.2rem', borderRadius: '12px', color: '#f59e0b' }}>
            <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>⏳ Account Pending Admin Approval</h4>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{notice}</p>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Link to="/login" className="btn-action" style={{ display: 'inline-block', width: 'auto', padding: '0.6rem 1.5rem', textDecoration: 'none' }}>Return to Login</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px', fontFamily: 'var(--font-body)' }}
              >
                <option value="CUSTOMER">🛒 Customer (Instant Activation)</option>
                <option value="RESTAURANT">🏪 Restaurant Owner (Admin Approval Required)</option>
                <option value="DELIVERY_PARTNER">🛵 Delivery Partner (Admin Verification Required)</option>
                <option value="NGO">🤝 NGO Partner (Admin Verification Required)</option>
              </select>
            </div>

            {role !== 'CUSTOMER' && (
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.8rem', color: '#f59e0b' }}>
                ⚠️ <strong>Admin Verification Required:</strong> Registrations for Restaurants, Delivery Partners, and NGOs require manual approval by an Administrator before access is unlocked.
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Full Name / Organization</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }}
              />
            </div>

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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Phone Number</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
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
              {loading ? 'Submitting Application...' : 'Create Account'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
