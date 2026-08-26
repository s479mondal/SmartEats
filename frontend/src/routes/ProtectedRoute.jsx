import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export const RoleRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Pending approval gate
  if (user && !user.approved && user.role !== 'CUSTOMER' && user.role !== 'ADMIN') {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="card" style={{ maxWidth: '540px', margin: '0 auto', borderColor: '#f59e0b' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', marginBottom: '0.8rem' }}>Approval Pending</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Your <strong>{user.role.replace('_', ' ')}</strong> account application is currently under administrator review. Full operational access will be granted once your application is verified and approved by an Admin.
          </p>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', color: '#f59e0b' }}>
            Status: <strong>PENDING_APPROVAL</strong>
          </div>
        </div>
      </div>
    );
  }

  if (!hasRole(allowedRoles)) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <div className="card" style={{ maxWidth: '480px', margin: '0 auto', borderColor: '#ef4444' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#ef4444', marginBottom: '0.8rem' }}>403 Access Denied</h2>
          <p style={{ color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            You do not have permission to access this resource. Your account role (<strong>{user?.role}</strong>) does not have authorization for this portal.
          </p>
        </div>
      </div>
    );
  }

  return children;
};
