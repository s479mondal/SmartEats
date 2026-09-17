import apiClient from './axiosClient';

export const restaurantApi = {
  getRestaurants: async () => {
    const response = await apiClient.get('/api/restaurants');
    return response.data?.data || response.data || [];
  },

  getRestaurantById: async (restaurantId) => {
    const response = await apiClient.get(`/api/restaurants/${restaurantId}`);
    return response.data?.data || response.data;
  },

  getNearbyRestaurants: async (latitude, longitude, radius = 5) => {
    const response = await apiClient.get('/api/restaurants/nearby', {
      params: {
        lat: latitude,
        lng: longitude,
        radius: radius
      }
    });
    return response.data?.data || response.data || [];
  },

  getMenu: async (restaurantId) => {
    const response = await apiClient.get(`/api/restaurants/${restaurantId}/menu`);
    return response.data?.data || response.data || [];
  }
};

