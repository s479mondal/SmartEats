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
  const status = user?.status || (user?.approved ? 'ACTIVE' : 'PENDING');
  if (user && status !== 'ACTIVE' && user.role !== 'CUSTOMER' && user.role !== 'ADMIN') {
    return <Navigate to="/application-pending" replace />;
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
