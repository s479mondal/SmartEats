import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smarteats_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const role = parsed.roles && parsed.roles.length > 0 ? parsed.roles[0] : parsed.role;
    return { ...parsed, role };
  });

  const [token, setToken] = useState(() => localStorage.getItem('smarteats_token') || null);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    // Support standard Spring Boot response directly containing { token, user }
    if (res && res.token && res.user) {
      const rawUser = res.user;
      const role = rawUser.roles && rawUser.roles.length > 0 ? rawUser.roles[0] : null;
      const userWithRole = { ...rawUser, role };
      
      setUser(userWithRole);
      setToken(res.token);
      localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
      localStorage.setItem('smarteats_token', res.token);
      return userWithRole;
    }
    // Fallback if wrapped in success/data format
    if (res && res.success && res.data) {
      const rawUser = res.data.user;
      const role = rawUser.roles && rawUser.roles.length > 0 ? rawUser.roles[0] : null;
      const userWithRole = { ...rawUser, role };

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
    // Support raw UserDto direct response from Spring Boot
    if (res && res.email) {
      const role = res.roles && res.roles.length > 0 ? res.roles[0] : null;
      const userWithRole = { ...res, role };

      if (res.approved) {
        setUser(userWithRole);
        setToken('mock-jwt-token');
        localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
        localStorage.setItem('smarteats_token', 'mock-jwt-token');
      }
      return userWithRole;
    }
    // Fallback if wrapped in success/data format
    if (res && res.success && res.data) {
      const role = res.data.roles && res.data.roles.length > 0 ? res.data.roles[0] : null;
      const userWithRole = { ...res.data, role };

      if (res.data.approved) {
        setUser(userWithRole);
        setToken('mock-jwt-token');
        localStorage.setItem('smarteats_user', JSON.stringify(userWithRole));
        localStorage.setItem('smarteats_token', 'mock-jwt-token');
      }
      return userWithRole;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smarteats_user');
    localStorage.removeItem('smarteats_token');
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    // Match either the parsed singular role string or any string in the roles list
    const singularRole = user.role;
    const pluralRoles = user.roles || [];
    return allowedRoles.includes(singularRole) || allowedRoles.some(r => pluralRoles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
