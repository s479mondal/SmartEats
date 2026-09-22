import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { notificationApi } from '../api/notificationApi';

const NotificationContext = createContext();

// Helper to format ISO createdAt to human-readable relative time
const formatRelativeTime = (dateInput) => {
  if (!dateInput) return 'Just now';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Recently';
    
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffSeconds < 0 || diffSeconds < 45) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mins ago`;
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    if (diffSeconds < 172800) return 'Yesterday';
    const days = Math.floor(diffSeconds / 86400);
    return `${days} days ago`;
  } catch {
    return 'Recently';
  }
};

// Map backend notification types to user-friendly titles
const deriveTitle = (type) => {
  switch (type) {
    case 'ORDER_CREATED':
      return 'Order Placed Successfully';
    case 'DELIVERY_ASSIGNED':
      return 'Delivery Partner Assigned';
    case 'ORDER_DELIVERED':
      return 'Order Delivered';
    case 'RESTAURANT_ACCEPTED':
      return 'Order Accepted by Kitchen';
    case 'ORDER_READY':
      return 'Order Ready for Pickup';
    case 'DELIVERY_OFFER':
      return '⚡ New Delivery Offer';
    case 'OFFER_CONFIRMED':
      return '✅ Assignment Confirmed';
    case 'OFFER_EXPIRED':
      return 'Offer No Longer Available';
    case 'DRIVER_ASSIGNED':
      return 'Delivery Partner Assigned';
    default:
      return type ? type.replace(/_/g, ' ') : 'SmartEats Update';
  }
};

// Normalize backend notification object to frontend structure
const mapNotification = (raw) => ({
  id: raw.id || raw._id || Date.now().toString(),
  title: deriveTitle(raw.type),
  message: raw.message || '',
  orderId: raw.orderId || null,
  type: raw.type || 'NOTIFICATION',
  read: Boolean(raw.read),
  createdAt: raw.createdAt || null,
  time: formatRelativeTime(raw.createdAt)
});

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Fetch real notifications from backend via API Gateway
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      const data = await notificationApi.getNotifications();
      if (Array.isArray(data) && isMountedRef.current) {
        const mapped = data.map(mapNotification);
        setNotifications(mapped);
      }
    } catch (err) {
      if (isMountedRef.current) {
        // Log clean warning without breaking UI
        console.warn('Failed to fetch real-time notifications from API Gateway:', err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, token]);

  // Initial fetch and 10-second polling lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated && token) {
      setLoading(true);
      fetchNotifications();

      // Lightweight 10s polling interval
      const intervalId = setInterval(() => {
        fetchNotifications();
      }, 10000);

      return () => {
        clearInterval(intervalId);
      };
    } else {
      // Clear notification state on logout / unauthenticated
      setNotifications([]);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isAuthenticated, token, user?.email, fetchNotifications]);

  // Mark all unread notifications as read (persists to backend where possible)
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    
    // Optimistic local state update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Sync to backend PUT /api/notifications/{id}/read
    if (unread.length > 0) {
      try {
        await Promise.allSettled(
          unread.map((n) => notificationApi.markAsRead(n.id))
        );
      } catch (err) {
        console.warn('Failed to persist markAllAsRead to backend:', err.message);
      }
    }
  };

  // Mark individual notification as read
  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await notificationApi.markAsRead(id);
    } catch (err) {
      console.warn(`Failed to mark notification ${id} as read:`, err.message);
    }
  };

  // Local helper for dynamic UI notifications
  const addNotification = (title, message) => {
    setNotifications((prev) => [
      {
        id: Date.now().toString(),
        title,
        message,
        time: 'Just now',
        read: false,
        type: 'LOCAL'
      },
      ...prev
    ]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAllAsRead,
        markAsRead,
        addNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
