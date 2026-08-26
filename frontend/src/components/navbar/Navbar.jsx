import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { unreadCount, notifications, markAllAsRead } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
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

  const handleScrollOrRedirect = (id, redirectPath) => {
    setMobileMenuOpen(false);
    if (window.location.pathname === '/') {
      const element = document.querySelector(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(redirectPath);
  };

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      padding: '0.8rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Brand logo/name */}
      <Link to="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        textDecoration: 'none',
        color: '#1e293b',
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontSize: '1.4rem'
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.15rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
        }}>
          ⚡
        </div>
        <div style={{ letterSpacing: '-0.5px' }}>
          Smart<span style={{ color: '#10b981' }}>Eats</span>
        </div>
      </Link>

      {/* Navigation Links */}
      <div className="desktop-nav" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        
        {/* Unauthenticated Navigation */}
        {!isAuthenticated && (
          <>
            <a href="#home" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#home', '/'); }} style={navLinkStyle}>Home</a>
            <a href="#restaurants" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#restaurants', '/restaurants'); }} style={navLinkStyle}>Restaurants</a>
            <a href="#rescue" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#rescue', '/food-rescue'); }} style={navLinkStyle}>Food Rescue</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#how-it-works', '/'); }} style={navLinkStyle}>How It Works</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#about', '/about'); }} style={navLinkStyle}>About</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#contact', '/contact'); }} style={navLinkStyle}>Contact</a>
          </>
        )}

        {/* Customer Logged In Navigation */}
        {isAuthenticated && isCustomer && (
          <>
            <Link to="/" style={navLinkStyle}>Home</Link>
            <Link to="/customer/restaurants" style={navLinkStyle}>Restaurants</Link>
            <Link to="/customer/restaurants" style={navLinkStyle}>Food</Link>
            <Link to="/customer/rescue" style={{ ...navLinkStyle, color: '#10b981', fontWeight: 800 }}>Food Rescue</Link>
            <Link to="/customer/dashboard" style={navLinkStyle}>My Orders</Link>
            <Link to="/customer/preferences" style={navLinkStyle}>Preferences</Link>
          </>
        )}

        {/* Non-Customer Portal Logged In Navigation */}
        {isAuthenticated && !isCustomer && (
          <>
            <Link to="/" style={navLinkStyle}>Home</Link>
            <Link to={getDashboardLink()} style={{ ...navLinkStyle, color: '#00f2fe', fontWeight: 800 }}>Dashboard</Link>
          </>
        )}
      </div>

      {/* Action Buttons (Right Side) */}
      <div className="desktop-buttons" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        
        {/* Notifications dropdown for logged in user */}
        {isAuthenticated && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              style={{
                background: 'rgba(15,23,42,0.04)',
                border: '1px solid #e2e8f0',
                color: '#1e293b',
                padding: '0.55rem',
                borderRadius: '12px',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ff5e3a',
                  color: '#fff',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  fontSize: '0.65rem',
                  fontWeight: 800
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '45px',
                width: '300px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                zIndex: 1000,
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, margin: 0, fontSize: '0.9rem' }}>Notifications</h4>
                  <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1rem 0', margin: 0 }}>No unread notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', opacity: n.read ? 0.6 : 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e293b' }}>{n.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customer Cart Link */}
        {isAuthenticated && isCustomer && (
          <Link to="/customer/dashboard" style={{
            textDecoration: 'none',
            background: 'rgba(255, 94, 58, 0.08)',
            border: '1px solid rgba(255, 94, 58, 0.25)',
            color: '#ff5e3a',
            padding: '0.55rem 1.1rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.85rem'
          }}>
            🛒 Cart
          </Link>
        )}

        {/* Session Buttons */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
              👤 {user.name || 'User'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                padding: '0.5rem 1rem',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link to="/login" style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '0.55rem 1.2rem',
              borderRadius: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.88rem'
            }}>
              Login
            </Link>
            <Link to="/register" style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '0.55rem 1.2rem',
              borderRadius: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.88rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              Register
            </Link>
          </div>
        )}
      </div>

      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="mobile-toggle"
        style={{
          display: 'none',
          background: 'transparent',
          border: 'none',
          fontSize: '1.5rem',
          color: '#1e293b',
          cursor: 'pointer',
          padding: '4px'
        }}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          zIndex: 99
        }}>
          {!isAuthenticated && (
            <>
              <a href="#home" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#home', '/'); }} style={mobileNavLinkStyle}>Home</a>
              <a href="#restaurants" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#restaurants', '/restaurants'); }} style={mobileNavLinkStyle}>Restaurants</a>
              <a href="#rescue" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#rescue', '/food-rescue'); }} style={mobileNavLinkStyle}>Food Rescue</a>
              <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#how-it-works', '/'); }} style={mobileNavLinkStyle}>How It Works</a>
              <a href="#about" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#about', '/about'); }} style={mobileNavLinkStyle}>About</a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); handleScrollOrRedirect('#contact', '/contact'); }} style={mobileNavLinkStyle}>Contact</a>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={mobileBtnSecondaryStyle}>Login</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} style={mobileBtnPrimaryStyle}>Register</Link>
              </div>
            </>
          )}

          {isAuthenticated && isCustomer && (
            <>
              <Link to="/" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Home</Link>
              <Link to="/customer/restaurants" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Restaurants</Link>
              <Link to="/customer/rescue" onClick={() => setMobileMenuOpen(false)} style={{ ...mobileNavLinkStyle, color: '#10b981' }}>Food Rescue</Link>
              <Link to="/customer/dashboard" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>My Orders</Link>
              <Link to="/customer/preferences" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Preferences</Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>👤 {user.name}</span>
                <button onClick={handleLogout} style={mobileLogoutBtnStyle}>Logout</button>
              </div>
            </>
          )}

          {isAuthenticated && !isCustomer && (
            <>
              <Link to="/" onClick={() => setMobileMenuOpen(false)} style={mobileNavLinkStyle}>Home</Link>
              <Link to={getDashboardLink()} onClick={() => setMobileMenuOpen(false)} style={{ ...mobileNavLinkStyle, color: '#00f2fe' }}>Dashboard</Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>👤 {user.name}</span>
                <button onClick={handleLogout} style={mobileLogoutBtnStyle}>Logout</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Embedded CSS for responsive toggles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .desktop-nav, .desktop-buttons {
            display: none !important;
          }
          .mobile-toggle {
            display: block !important;
          }
        }
      `}} />
    </nav>
  );
}

const navLinkStyle = {
  color: '#475569',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.92rem',
  transition: 'color 0.2s',
  cursor: 'pointer'
};

const mobileNavLinkStyle = {
  color: '#475569',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  paddingBottom: '4px',
  borderBottom: '1px solid #f1f5f9'
};

const mobileBtnPrimaryStyle = {
  flex: 1,
  textAlign: 'center',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  padding: '0.7rem',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '0.9rem'
};

const mobileBtnSecondaryStyle = {
  flex: 1,
  textAlign: 'center',
  border: '1px solid #cbd5e1',
  color: '#475569',
  padding: '0.7rem',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '0.9rem'
};

const mobileLogoutBtnStyle = {
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  color: '#ef4444',
  padding: '0.4rem 0.8rem',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '0.8rem'
};
