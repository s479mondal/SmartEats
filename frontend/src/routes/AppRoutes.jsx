import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from '../components/navbar/Navbar';
import Footer from '../components/footer/Footer';
import Home from '../pages/Home';
import Login from '../pages/public/Login';
import Register from '../pages/public/Register';
import ApplicationPending from '../pages/public/ApplicationPending';
import CustomerPortal from '../components/CustomerPortal';
import RescueOffersPage from '../pages/customer/RescueOffersPage';
import PreferencesPage from '../pages/customer/PreferencesPage';
import RestaurantDetailPage from '../pages/customer/RestaurantDetailPage';
import RestaurantRdssDashboard from '../components/RestaurantRdssDashboard';
import DriverPortal from '../components/DriverPortal';
import NgoDashboard from '../pages/ngo/NgoDashboard';
import AdminDashboard from '../pages/admin/AdminDashboard';
import { ProtectedRoute, RoleRoute } from './ProtectedRoute';
import { validateAddToCart } from '../utils/inventoryUtils';

// Generic placeholder for public subpages
const ComingSoon = ({ title }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center',
    padding: '2rem',
    fontFamily: 'var(--font-body)',
    background: '#f8fafc',
    color: '#0f172a'
  }}>
    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</span>
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800 }}>{title}</h2>
    <p style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '2rem' }}>This workspace capability is currently under development. Stay tuned!</p>
    <a href="/" style={{
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      padding: '0.75rem 1.8rem',
      borderRadius: '12px',
      textDecoration: 'none',
      fontWeight: 700
    }}>Return to Homepage</a>
  </div>
);

export default function AppRoutes() {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('smarteats_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem('smarteats_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item, qtyToAdd = 1) => {
    if (!item) return false;

    // Boundary & Availability validation
    const validation = validateAddToCart(item, cart, qtyToAdd);
    if (!validation.allowed) {
      alert(validation.message || 'Cannot add item to cart.');
      return false;
    }

    const id = item.id || item._id;
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => (i.id || i._id) === id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIndex].qty || 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...item,
          qty: currentQty + qtyToAdd
        };
        return updated;
      }
      return [...prev, { ...item, qty: qtyToAdd }];
    });
    return true;
  };

  const updateCartQty = (itemId, newQty, maxAvailableQty) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return true;
    }

    if (maxAvailableQty !== null && maxAvailableQty !== undefined && newQty > Number(maxAvailableQty)) {
      alert('Only the currently available portions can be added.');
      return false;
    }

    setCart((prev) =>
      prev.map((i) => {
        if ((i.id || i._id) === itemId) {
          return { ...i, qty: newQty };
        }
        return i;
      })
    );
    return true;
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((i) => (i.id || i._id) !== itemId));
  };

  return (
    <div>
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - 240px)' }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<ComingSoon title="About SmartEats" />} />
          <Route path="/contact" element={<ComingSoon title="Contact Desk" />} />
          <Route path="/restaurants" element={<CustomerPortal cart={cart} setCart={setCart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} />} />
          <Route path="/restaurants/:restaurantId" element={<RestaurantDetailPage cart={cart} setCart={setCart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} />} />
          <Route path="/food-rescue" element={<RescueOffersPage addToCart={addToCart} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/application-pending" element={<ApplicationPending />} />

          {/* Customer Routes */}
          <Route path="/customer/dashboard" element={<CustomerPortal cart={cart} setCart={setCart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} />} />
          <Route path="/customer/restaurants" element={<CustomerPortal cart={cart} setCart={setCart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} />} />
          <Route path="/customer/restaurants/:restaurantId" element={<RestaurantDetailPage cart={cart} setCart={setCart} addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} />} />
          <Route path="/customer/rescue" element={<RescueOffersPage addToCart={addToCart} />} />
          <Route path="/customer/preferences" element={<PreferencesPage />} />

          {/* Restaurant Routes (RBAC Protection) */}
          <Route
            path="/restaurant/*"
            element={
              <RoleRoute allowedRoles={['RESTAURANT', 'RESTAURANT_OWNER', 'ADMIN']}>
                <RestaurantRdssDashboard />
              </RoleRoute>
            }
          />

          {/* Delivery Partner Routes (RBAC Protection) */}
          <Route
            path="/delivery/*"
            element={
              <RoleRoute allowedRoles={['DELIVERY_PARTNER', 'ADMIN']}>
                <DriverPortal />
              </RoleRoute>
            }
          />

          {/* NGO Routes (RBAC Protection) */}
          <Route
            path="/ngo/*"
            element={
              <RoleRoute allowedRoles={['NGO', 'ADMIN']}>
                <NgoDashboard />
              </RoleRoute>
            }
          />

          {/* Admin Routes (RBAC Protection) */}
          <Route
            path="/admin/*"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </RoleRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
