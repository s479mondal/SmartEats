import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smarteats_user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const role = parsed.roles && parsed.roles.length > 0 ? parsed.roles[0] : parsed.role;
      const status = parsed.status || (parsed.approved ? 'ACTIVE' : 'PENDING');
      return { ...parsed, role, status };
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('smarteats_token') || null);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    // Support response directly containing { token, user }
    if (res && res.token && res.user) {
      const rawUser = res.user;
      const role = rawUser.roles && rawUser.roles.length > 0 ? rawUser.roles[0] : rawUser.role;
      const status = rawUser.status || (rawUser.approved ? 'ACTIVE' : 'PENDING');
      const userWithRole = { ...rawUser, role, status };
      
      setUser(userWithRole);
      setToken(res.token);
      localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
      localStorage.setItem('smarteats_token', res.token);
      return userWithRole;
    }
    // Fallback if wrapped in success/data format
    if (res && res.success && res.data) {
      const rawUser = res.data.user;
      const role = rawUser.roles && rawUser.roles.length > 0 ? rawUser.roles[0] : rawUser.role;
      const status = rawUser.status || (rawUser.approved ? 'ACTIVE' : 'PENDING');
      const userWithRole = { ...rawUser, role, status };

      setUser(userWithRole);
      setToken(res.data.token);
      localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
      localStorage.setItem('smarteats_token', res.data.token);
      return userWithRole;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await authApi.register(userData);
    const rawData = res.data || res;
    if (rawData && rawData.email) {
      const role = rawData.roles && rawData.roles.length > 0 ? rawData.roles[0] : null;
      const status = rawData.status || (rawData.approved ? 'ACTIVE' : 'PENDING');
      const userWithRole = { ...rawData, role, status };

      if (status === 'ACTIVE') {
        setUser(userWithRole);
        setToken('mock-jwt-token');
        localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
        localStorage.setItem('smarteats_token', 'mock-jwt-token');
      } else {
        // Save pending user so /application-pending can display application summary
        setUser(userWithRole);
        localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
      }
      return userWithRole;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const refreshUserStatus = async () => {
    if (!user || !user.email) return null;
    try {
      const res = await authApi.getProfile(user.email);
      const rawData = res.data || res;
      if (rawData && rawData.email) {
        const role = rawData.roles && rawData.roles.length > 0 ? rawData.roles[0] : user.role;
        const status = rawData.status || (rawData.approved ? 'ACTIVE' : 'PENDING');
        const updated = { ...user, ...rawData, role, status };
        setUser(updated);
        localStorage.setItem('smarteats_user', JSON.stringify(updated));
        return updated;
      }
    } catch (err) {
      console.warn('Could not refresh user status:', err);
    }
    return user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smarteats_user');
    localStorage.removeItem('smarteats_token');
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    const singularRole = user.role;
    const pluralRoles = user.roles || [];
    return allowedRoles.includes(singularRole) || allowedRoles.some(r => pluralRoles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && (!!token || user.status === 'PENDING'),
        login,
        register,
        refreshUserStatus,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
