import apiClient from './axiosClient';

export const orderApi = {
  createPaymentOrder: async (idempotencyKey) => {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post('/api/orders/payment/create-order', null, { headers });
    return response.data?.data || response.data;
  },

  verifyPayment: async (verificationPayload) => {
    const response = await apiClient.post('/api/orders/payment/verify', verificationPayload);
    return response.data?.data || response.data;
  },

  placeCodOrder: async (idempotencyKey) => {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post('/api/orders/cod', null, { headers });
    return response.data?.data || response.data;
  },

  createOrder: async (orderPayload, idempotencyKey) => {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    try {
      const response = await apiClient.post('/api/orders/checkout', orderPayload, { headers });
      return response.data?.data || response.data;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 403 || err.response?.status === 409 || err.response?.data?.message) {
        throw err;
      }
      const response = await apiClient.post('/api/orders/checkout', orderPayload, { headers });
      return response.data?.data || response.data;
    }
  },

  getOrderById: async (orderId) => {
    const response = await apiClient.get(`/api/orders/${orderId}`);
    return response.data?.data || response.data;
  },

  getCustomerOrders: async () => {
    const response = await apiClient.get('/api/orders/customer');
    return response.data?.data || response.data || [];
  }
};

export const cartApi = {
  addToCart: async (restaurantId, item) => {
    try {
      const response = await apiClient.post(`/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`, {
        menuItemId: item.menuItemId || item.id || item._id || 'item-101',
        itemId: item.id || item._id || 'item-101',
        quantity: item.qty || 1,
        price: item.price || item.rescuePrice || 100,
        name: item.name || 'Food Item'
      });
      return response.data?.data || response.data;
    } catch (err) {
      console.warn('Backend cart sync note:', err.message);
      return null;
    }
  },

  getCart: async () => {
    try {
      const response = await apiClient.get('/api/orders/cart');
      return response.data?.data || response.data;
    } catch {
      return null;
    }
  },

  clearCart: async () => {
    try {
      const response = await apiClient.delete('/api/orders/cart');
      return response.data?.data || response.data;
    } catch {
      return null;
    }
  },

  checkout: async () => {
    const response = await apiClient.post('/api/orders/checkout');
    return response.data?.data || response.data;
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

  getAllUsers: async (status = 'ALL') => {
    const response = await apiClient.get(`/api/admin/users?status=${status}`);
    return response.data?.data || response.data || [];
  },

  updateApprovalStatus: async (type, id, action, rejectionReason = '') => {
    const response = await apiClient.put(`/api/admin/approvals/${type}/${id}`, { action, rejectionReason });
    return response.data;
  }
};

export const restaurantOwnerApi = {
  getMyProfile: async () => {
    const response = await apiClient.get('/api/restaurants/my');
    return response.data?.data || response.data;
  },

  updateMyProfile: async (payload) => {
    const response = await apiClient.put('/api/restaurants/my', payload);
    return response.data?.data || response.data;
  },

  getMyMenu: async () => {
    const response = await apiClient.get('/api/restaurants/my/menu');
    return response.data?.data || response.data || [];
  },

  addMenuItem: async (payload) => {
    const response = await apiClient.post('/api/restaurants/my/menu', payload);
    return response.data?.data || response.data;
  },

  updateMenuItem: async (itemId, payload) => {
    const response = await apiClient.put(`/api/restaurants/my/menu/${itemId}`, payload);
    return response.data?.data || response.data;
  },

  deleteMenuItem: async (itemId) => {
    const response = await apiClient.delete(`/api/restaurants/my/menu/${itemId}`);
    return response.data;
  },

  toggleMenuItemAvailability: async (itemId, available) => {
    const response = await apiClient.patch(`/api/restaurants/my/menu/${itemId}/availability?available=${available}`);
    return response.data?.data || response.data;
  },

  getMyOrders: async () => {
    const response = await apiClient.get('/api/orders/my/orders');
    return response.data?.data || response.data || [];
  },

  acceptOrder: async (orderId) => {
    const response = await apiClient.patch(`/api/orders/my/orders/${orderId}/accept`);
    return response.data?.data || response.data;
  },

  rejectOrder: async (orderId) => {
    const response = await apiClient.patch(`/api/orders/my/orders/${orderId}/reject`);
    return response.data?.data || response.data;
  },

  preparingOrder: async (orderId) => {
    const response = await apiClient.patch(`/api/orders/my/orders/${orderId}/preparing`);
    return response.data?.data || response.data;
  },

  readyOrder: async (orderId) => {
    const response = await apiClient.patch(`/api/orders/my/orders/${orderId}/ready`);
    return response.data?.data || response.data;
  },

  submitChangeRequest: async (payload) => {
    const response = await apiClient.post('/api/restaurants/my/change-requests', payload);
    return response.data?.data || response.data;
  },

  getMyChangeRequests: async () => {
    const response = await apiClient.get('/api/restaurants/my/change-requests');
    return response.data?.data || response.data || [];
  },

  getPendingChangeRequests: async () => {
    const response = await apiClient.get('/api/restaurants/admin/change-requests');
    return response.data?.data || response.data || [];
  },

  approveChangeRequest: async (id) => {
    const response = await apiClient.put(`/api/restaurants/admin/change-requests/${id}/approve`);
    return response.data?.data || response.data;
  },

  rejectChangeRequest: async (id, reason) => {
    const response = await apiClient.put(`/api/restaurants/admin/change-requests/${id}/reject`, { reason });
    return response.data?.data || response.data;
  }
};

export const deliveryApi = {
  getMyDeliveries: async () => {
    const response = await apiClient.get('/api/deliveries/my-deliveries');
    return response.data?.data || response.data || [];
  },

  acceptDelivery: async (deliveryId) => {
    const response = await apiClient.put(`/api/deliveries/${deliveryId}/accept`);
    return response.data?.data || response.data;
  },

  updateDeliveryStatus: async (deliveryId, status) => {
    const response = await apiClient.put(`/api/deliveries/${deliveryId}/status?status=${status}`);
    return response.data?.data || response.data;
  },

  updatePartnerAvailability: async (active, available) => {
    const response = await apiClient.put(`/api/deliveries/partner/availability?active=${active}&available=${available}`);
    return response.data?.data || response.data;
  }
};

export const rdssApi = {
  getDemandForecast: async (restaurantId = 'rest-101') => {
    const response = await apiClient.get(`/api/rdss/forecast?restaurant_id=${encodeURIComponent(restaurantId)}`);
    return response.data?.data || response.data;
  },

  checkSurplus: async (payload) => {
    const response = await apiClient.post('/api/rdss/surplus-check', payload);
    return response.data?.data || response.data;
  },

  matchDriver: async (payload) => {
    const response = await apiClient.post('/api/rdss/match-driver', payload);
    return response.data?.data || response.data;
  }
};
