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
  },

  searchLocations: async (query, signal) => {
    const response = await apiClient.get('/api/auth/location/search', {
      params: { query },
      signal
    });
    return response.data?.data || response.data || [];
  },

  reverseGeocode: async (lat, lng, signal) => {
    const response = await apiClient.get('/api/auth/location/reverse', {
      params: { lat, lng },
      signal
    });
    return response.data?.data || response.data;
  },

  lookupPincode: async (pincode, signal) => {
    const response = await apiClient.get(`/api/auth/location/pincode/${encodeURIComponent(pincode)}`, {
      signal
    });
    return response.data?.data || response.data;
  }
};
