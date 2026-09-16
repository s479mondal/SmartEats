import apiClient from './axiosClient';

export const notificationApi = {
  getNotifications: async () => {
    const response = await apiClient.get('/api/notifications');
    return response.data?.data || response.data || [];
  },

  markAsRead: async (id) => {
    const response = await apiClient.put(`/api/notifications/${id}/read`);
    return response.data?.data || response.data;
  },

  getUnreadCount: async () => {
    const response = await apiClient.get('/api/notifications/unread-count');
    return response.data?.data ?? response.data;
  }
};
