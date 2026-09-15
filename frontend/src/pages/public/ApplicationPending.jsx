import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ApplicationPending() {
  const { user, refreshUserStatus, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const navigate = useNavigate();

  const handleCheckStatus = async () => {
    setChecking(true);
    setRefreshMsg('');
    try {
      const updated = await refreshUserStatus();
      if (updated && updated.status === 'ACTIVE') {
        setRefreshMsg('🎉 Congratulations! Your application has been approved.');
      } else if (updated && updated.status === 'REJECTED') {
        setRefreshMsg('⚠️ Application status is currently REJECTED.');
      } else {
        setRefreshMsg('⏳ Your application is still under review by our Administrator.');
      }
    } catch {
      setRefreshMsg('Could not reach API Gateway. Please try again in a few moments.');
    } finally {
      setChecking(false);
    }
  };

  const status = user?.status || (user?.approved ? 'ACTIVE' : 'PENDING');
  const roleName = user?.role ? user.role.replace('_', ' ') : 'Partner';

  const getDashboardRoute = () => {
    if (user?.role === 'RESTAURANT_OWNER' || user?.role === 'RESTAURANT') return '/restaurant/dashboard';
    if (user?.role === 'DELIVERY_PARTNER') return '/delivery/dashboard';
    if (user?.role === 'NGO') return '/ngo/dashboard';
    if (user?.role === 'ADMIN') return '/admin/dashboard';
    return '/customer/dashboard';
  };

  return (
    <div className="container" style={{ maxWidth: '680px', marginTop: '3.5rem', marginBottom: '4rem' }}>
      <div className="card" style={{
        borderColor: status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.4)' : (status === 'REJECTED' ? 'rgba(239, 68, 68, 0.4)' : (status === 'SUSPENDED' ? 'rgba(156, 163, 175, 0.4)' : 'rgba(245, 158, 11, 0.4)')),
        boxShadow: status === 'ACTIVE' ? '0 12px 36px rgba(16, 185, 129, 0.15)' : '0 12px 36px rgba(0, 0, 0, 0.4)'
      }}>
        
        {/* Status Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {status === 'ACTIVE' && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎉</div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', fontSize: '1.8rem', marginBottom: '0.4rem' }}>Account Approved & Active!</h2>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
                Your <strong>{roleName}</strong> application has been verified and approved by the Platform Administrator.
              </p>
            </>
          )}

          {status === 'PENDING' && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem', animation: 'pulse 2s infinite' }}>⏳</div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', fontSize: '1.8rem', marginBottom: '0.4rem' }}>Application Pending Review</h2>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
                Thank you for applying to join SmartEats as a <strong>{roleName}</strong>. Your profile is currently under administrator verification.
              </p>
            </>
          )}

          {status === 'REJECTED' && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>❌</div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ef4444', fontSize: '1.8rem', marginBottom: '0.4rem' }}>Application Not Approved</h2>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
                We regret to inform you that your <strong>{roleName}</strong> application has not been approved at this time.
              </p>
            </>
          )}

          {status === 'SUSPENDED' && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>⏸️</div>
              <h2 style={{ fontFamily: 'var(--font-heading)', color: '#94a3b8', fontSize: '1.8rem', marginBottom: '0.4rem' }}>Account Suspended</h2>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
                Your account operations are currently paused by the Platform Administrator.
              </p>
            </>
          )}
        </div>

        {/* Rejection Reason Alert if applicable */}
        {status === 'REJECTED' && user?.rejectionReason && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#ef4444', marginBottom: '0.3rem', fontSize: '0.95rem' }}>📌 Administrator Feedback / Reason:</h4>
            <p style={{ color: '#fca5a5', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
              "{user.rejectionReason}"
            </p>
          </div>
        )}

        {/* Visual Progress Stepper for Pending */}
        {status === 'PENDING' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--bg-card-border)', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontWeight: 800, fontSize: '0.85rem' }}>✓</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Registration</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Submitted</div>
              </div>
              <div style={{ height: '2px', flex: 1, background: '#f59e0b' }}></div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontWeight: 800, fontSize: '0.85rem' }}>2</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>Admin Review</div>
                <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>In Progress</div>
              </div>
              <div style={{ height: '2px', flex: 1, background: 'rgba(255, 255, 255, 0.1)' }}></div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontWeight: 800, fontSize: '0.85rem' }}>3</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-sub)' }}>Activation</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Operational</div>
              </div>
            </div>
          </div>
        )}

        {/* Submitted Application Summary Card */}
        {user && (
          <div style={{ background: '#1e293b', border: '1px solid var(--bg-card-border)', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '0.8rem', fontSize: '0.95rem' }}>
              📋 Submitted Profile Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Applicant Name</span>
                <strong style={{ color: '#fff' }}>{user.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Registered Email</span>
                <strong style={{ color: '#fff' }}>{user.email}</strong>
              </div>
              {user.phone && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Phone Number</span>
                  <strong style={{ color: '#fff' }}>{user.phone}</strong>
                </div>
              )}
              {user.restaurantName && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Restaurant Name</span>
                  <strong style={{ color: '#00f2fe' }}>{user.restaurantName}</strong>
                </div>
              )}
              {user.cuisineType && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Cuisine Category</span>
                  <strong style={{ color: '#fff' }}>{user.cuisineType}</strong>
                </div>
              )}
              {user.vehicleType && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Vehicle Type & Number</span>
                  <strong style={{ color: '#00f2fe' }}>{user.vehicleType} ({user.vehicleNumber || 'N/A'})</strong>
                </div>
              )}
              {user.ngoName && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>NGO Organization</span>
                  <strong style={{ color: '#a855f7' }}>{user.ngoName}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Refresh Status Message Feedback */}
        {refreshMsg && (
          <div style={{
            background: refreshMsg.includes('approved') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${refreshMsg.includes('approved') ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
            padding: '0.8rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            color: refreshMsg.includes('approved') ? 'var(--accent-green)' : '#f59e0b'
          }}>
            {refreshMsg}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {status === 'ACTIVE' ? (
            <button
              onClick={() => navigate(getDashboardRoute())}
              className="btn-action"
              style={{ width: 'auto', padding: '0.8rem 2rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              🚀 Launch Operational Dashboard
            </button>
          ) : (
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="btn-action"
              style={{ width: 'auto', padding: '0.8rem 1.8rem' }}
            >
              {checking ? 'Checking Live Status...' : '🔄 Refresh & Check Status'}
            </button>
          )}

          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-sub)',
              padding: '0.8rem 1.5rem',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>

          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              padding: '0.8rem 1.5rem',
              borderRadius: '12px',
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            Return to Home
          </Link>
        </div>

      </div>
    </div>
  );
}
