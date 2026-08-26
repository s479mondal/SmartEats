import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [role, setRole] = useState('ROLE_CUSTOMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const requiresApproval = role === 'ROLE_RESTAURANT_OWNER' || role === 'ROLE_DELIVERY_PARTNER';

  const handleSubmit = (e) => {
    e.preventDefault();
    const userObj = {
      name,
      email,
      role,
      approved: !requiresApproval,
      status: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED'
    };

    if (requiresApproval) {
      alert(`Registration Request Submitted!\n\nRole: ${role.replace('ROLE_', '')}\nStatus: PENDING_APPROVAL\n\nYour account has been submitted to the Admin portal for verification. You will receive access once approved.`);
    } else {
      alert(`Success! Customer account for ${name} (${email}) has been registered and instantly activated!`);
      onAuthSuccess(userObj);
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', borderColor: 'rgba(255, 94, 58, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)' }}>Sign Up for SmartEats</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px', fontFamily: 'var(--font-body)' }}
            >
              <option value="ROLE_CUSTOMER">🛒 Customer (Instant Activation)</option>
              <option value="ROLE_RESTAURANT_OWNER">🏪 Restaurant Owner (Admin Approval Required)</option>
              <option value="ROLE_DELIVERY_PARTNER">🛵 Delivery Partner (Admin Verification Required)</option>
            </select>
          </div>

          {requiresApproval && (
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '0.8rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.8rem', color: '#f59e0b' }}>
              ⚠️ <strong>Admin Verification Required:</strong> Registrations for Restaurant Owners and Delivery Partners require manual verification by an Admin before login is enabled.
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Full Name</label>
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

          <button type="submit" className="btn-action">Complete Registration</button>
        </form>
      </div>
    </div>
  );
}
