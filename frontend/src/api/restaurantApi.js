import apiClient from './axiosClient';

export const restaurantApi = {
  getRestaurants: async () => {
    const response = await apiClient.get('/api/restaurants');
    return response.data?.data || response.data || [];
  },

  getMenu: async (restaurantId) => {
    const response = await apiClient.get(`/api/restaurants/${restaurantId}/menu`);
    return response.data?.data || response.data || [];
  }
};
