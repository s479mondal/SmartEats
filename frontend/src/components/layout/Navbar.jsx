import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!user) return '/';
    const role = user.role?.toUpperCase();
    if (role === 'ADMIN') return '/admin/dashboard';
    if (role === 'RESTAURANT' || role === 'RESTAURANT_OWNER') return '/restaurant/dashboard';
    if (role === 'DELIVERY_PARTNER' || role === 'DRIVER') return '/delivery/dashboard';
    if (role === 'NGO') return '/ngo/dashboard';
    return '/customer/dashboard';
  };

  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <header>
      <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="brand-icon">⚡</div>
        <div className="brand-text">Smart<span>Eats</span></div>
      </Link>

      <nav style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Home</Link>
        <Link to="/customer/restaurants" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Restaurants</Link>
        
        {/* Customer Specific Links after login */}
        {isAuthenticated && isCustomer && (
          <>
            <Link to="/customer/restaurants" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Food</Link>
            <Link to="/customer/rescue" style={{ color: 'var(--accent-green)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>Food Rescue</Link>
            <Link to="/customer/dashboard" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>My Orders</Link>
            <Link to="/customer/preferences" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Preferences</Link>
          </>
        )}

        {!isAuthenticated && (
          <>
            <Link to="/customer/rescue" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Food Rescue</Link>
            <a href="#how-it-works" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>How It Works</a>
            <Link to="/about" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>About</Link>
            <Link to="/contact" style={{ color: 'var(--text-sub)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Contact</Link>
          </>
        )}

        {isAuthenticated && !isCustomer && (
          <Link to={getDashboardLink()} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            Dashboard
          </Link>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Notification Bell */}
        {isAuthenticated && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--bg-card-border)', color: '#fff', padding: '0.6rem', borderRadius: '12px', cursor: 'pointer', position: 'relative' }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--primary)', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800 }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div className="card" style={{ position: 'absolute', right: 0, top: '48px', width: '320px', zIndex: 1000, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)' }}>Notifications</h4>
                  <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer' }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {notifications.map((n) => (
                    <div key={n.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: n.read ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{n.title}</div>
                        {n.time && <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginLeft: '6px' }}>{n.time}</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '2px' }}>{n.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customer Cart Quick Button */}
        {isAuthenticated && isCustomer && (
          <Link to="/customer/dashboard" style={{ textDecoration: 'none', background: 'rgba(255, 94, 58, 0.15)', border: '1px solid rgba(255, 94, 58, 0.3)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem' }}>
            🛒 Cart
          </Link>
        )}

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              👤 {user.name || 'User'}
            </span>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/login" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--bg-card-border)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' }}>
              Login
            </Link>
            <Link to="/register" style={{ background: 'var(--primary-gradient)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' }}>
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
