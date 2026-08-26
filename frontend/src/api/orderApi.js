import apiClient from './axiosClient';

export const orderApi = {
  createOrder: async (orderPayload) => {
    const response = await apiClient.post('/api/orders/checkout', orderPayload);
    return response.data;
  },

  getOrderById: async (orderId) => {
    const response = await apiClient.get(`/api/orders/${orderId}`);
    return response.data;
  }
};

export const rescueApi = {
  getRescueOffers: async () => {
    try {
      const response = await apiClient.get('/api/rescue/offers');
      return response.data?.data || response.data || [];
    } catch (err) {
      console.warn('API Gateway /api/rescue/offers not implemented yet. Returning mock active rescue offers.');
      return [
        {
          id: "r1",
          name: "Paneer Biryani Handi",
          restaurant: "Tandoor Express",
          originalPrice: 300,
          rescuePrice: 150,
          discountPct: 50,
          expiresMinutes: 28,
          remainingQty: 3
        },
        {
          id: "r2",
          name: "Veg Meal Box",
          restaurant: "The Green Bowl",
          originalPrice: 250,
          rescuePrice: 135,
          discountPct: 46,
          expiresMinutes: 35,
          remainingQty: 5
        },
        {
          id: "r3",
          name: "Woodfired Margherita Pizza",
          restaurant: "La Piazza Bella",
          originalPrice: 450,
          rescuePrice: 292,
          discountPct: 35,
          expiresMinutes: 18,
          remainingQty: 1
        }
      ];
    }
  }
};

export const adminApi = {
  getPendingApprovals: async () => {
    const response = await apiClient.get('/api/admin/approvals/pending');
    return response.data?.data || response.data || { restaurants: [], deliveryPartners: [], ngos: [] };
  },

  updateApprovalStatus: async (type, id, action) => {
    const response = await apiClient.put(`/api/admin/approvals/${type}/${id}`, { action });
    return response.data;
  }
};
