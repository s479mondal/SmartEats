import apiClient from './axiosClient';

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await apiClient.post('/api/auth/register', userData);
    return response.data;
  },

  getProfile: async (email) => {
    const response = await apiClient.get(`/api/auth/profile?email=${encodeURIComponent(email)}`);
    return response.data;
  }
};
