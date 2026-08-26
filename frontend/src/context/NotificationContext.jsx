import React, { createContext, useContext, useState } from 'react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Order Placed Successfully', message: 'Order #ORD-9842 confirmed via Kafka stream!', time: '10 mins ago', read: false },
    { id: '2', title: 'RDSS Surplus Alert', message: 'New 35% discount active on Woodfired Margherita!', time: '25 mins ago', read: false }
  ]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNotification = (title, message) => {
    setNotifications((prev) => [
      { id: Date.now().toString(), title, message, time: 'Just now', read: false },
      ...prev
    ]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAllAsRead, addNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
