import React, { useState, useEffect } from 'react';
import { restaurantOwnerApi, rdssApi, deliveryApi } from '../api/orderApi';
import { useAuth } from '../context/AuthContext';
import { cleanTelUri, formatIndianPhone } from '../utils/phoneUtils';

const normalizeToTimeInputValue = (timeStr, defaultVal = '10:00') => {
  if (!timeStr) return defaultVal;
  const cleaned = timeStr.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned)) {
    return cleaned;
  }
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return defaultVal;
};

export default function RestaurantRdssDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'profile', 'menu', 'orders', 'ai'

  // Profile State
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    description: '',
    phone: '',
    email: '',
    openingTime: '10:00',
    closingTime: '22:00',
    logoUrl: '',
    open: true,
    cuisineType: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  // Profile Change Request State (Major Identity Fields)
  const [changeRequests, setChangeRequests] = useState([]);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [changeRequestForm, setChangeRequestForm] = useState({
    requestedRestaurantName: '',
    requestedAddress: '',
    requestedCity: '',
    requestedPincode: '',
    requestedBusinessRegistrationNumber: '',
    requestedFoodLicenseNumber: '',
    reason: ''
  });
  const [changeRequestMessage, setChangeRequestMessage] = useState({ type: '', text: '' });

  // Menu State
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Main Course',
    available: true
  });
  const [menuMessage, setMenuMessage] = useState({ type: '', text: '' });

  // Orders State
  const [orders, setOrders] = useState([]);
  const [deliveriesByOrderId, setDeliveriesByOrderId] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');

  // AI RDSS State
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');

  const [surplusForm, setSurplusForm] = useState({
    menuItemId: 'item-101',
    inventoryCount: 25,
    salesVelocityPerHour: 2.5,
    hoursLeftInDay: 2.0,
    originalPrice: 250
  });
  const [surplusResult, setSurplusResult] = useState(null);
  const [surplusLoading, setSurplusLoading] = useState(false);
  const [surplusError, setSurplusError] = useState('');

  const [driverMatchForm, setDriverMatchForm] = useState({
    orderId: 'ORD-101',
    restaurantLat: 12.9716,
    restaurantLng: 77.5946,
    riderLat: 12.9725,
    riderLng: 77.5937,
    foodPrepEtaMinutes: 15
  });
  const [driverMatchResult, setDriverMatchResult] = useState(null);
  const [driverMatchLoading, setDriverMatchLoading] = useState(false);
  const [driverMatchError, setDriverMatchError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchChangeRequests();
    fetchMenu();
    fetchOrders();
    fetchForecast();
  }, []);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const data = await restaurantOwnerApi.getMyProfile();
      setProfile(data);
      if (data) {
        setProfileForm({
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || user?.email || '',
          openingTime: normalizeToTimeInputValue(data.openingTime, '10:00'),
          closingTime: normalizeToTimeInputValue(data.closingTime, '22:00'),
          logoUrl: data.logoUrl || '',
          open: data.open ?? true,
          cuisineType: data.cuisineType || ''
        });
      }
    } catch (err) {
      console.warn('Could not fetch restaurant profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchChangeRequests = async () => {
    try {
      const data = await restaurantOwnerApi.getMyChangeRequests();
      setChangeRequests(data);
    } catch (err) {
      console.warn('Could not fetch change requests:', err);
    }
  };

  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      const data = await restaurantOwnerApi.getMyMenu();
      setMenuItems(data);
    } catch (err) {
      console.warn('Could not fetch menu items:', err);
    } finally {
      setMenuLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await restaurantOwnerApi.getMyOrders();
      const orderList = Array.isArray(data) ? data : [];
      setOrders(orderList);

      // Asynchronously fetch delivery details for non-cancelled active orders
      const activeOrders = orderList.filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED');
      if (activeOrders.length > 0) {
        const deliveryPromises = activeOrders.map(async (ord) => {
          try {
            const delivery = await deliveryApi.getDeliveryByOrderId(ord.id);
            return { orderId: ord.id, delivery };
          } catch {
            return { orderId: ord.id, delivery: null };
          }
        });
        const results = await Promise.all(deliveryPromises);
        const map = {};
        results.forEach(r => {
          if (r.delivery) map[r.orderId] = r.delivery;
        });
        setDeliveriesByOrderId(prev => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.warn('Could not fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchForecast = async () => {
    setForecastLoading(true);
    setForecastError('');
    try {
      const data = await rdssApi.getDemandForecast(profile?.id || 'rest-101');
      setForecastData(data);
    } catch (err) {
      console.warn('Could not fetch demand forecast from AI service:', err);
      setForecastError('AI Service Unavailable: Make sure Python FastAPI is running on port 8000 and Gateway routes /api/rdss/**.');
    } finally {
      setForecastLoading(false);
    }
  };

  const handleRunSurplusCheck = async (e) => {
    e.preventDefault();
    setSurplusLoading(true);
    setSurplusError('');
    try {
      const result = await rdssApi.checkSurplus({
        menuItemId: surplusForm.menuItemId,
        inventoryCount: parseInt(surplusForm.inventoryCount),
        salesVelocityPerHour: parseFloat(surplusForm.salesVelocityPerHour),
        hoursLeftInDay: parseFloat(surplusForm.hoursLeftInDay),
        originalPrice: parseFloat(surplusForm.originalPrice)
      });
      setSurplusResult(result);
    } catch (err) {
      setSurplusError('Failed to run AI surplus evaluation: ' + (err.response?.data?.message || err.message));
    } finally {
      setSurplusLoading(false);
    }
  };

  const handleRunDriverMatch = async (e) => {
    e.preventDefault();
    setDriverMatchLoading(true);
    setDriverMatchError('');
    try {
      const result = await rdssApi.matchDriver({
        orderId: driverMatchForm.orderId,
        restaurantLat: parseFloat(driverMatchForm.restaurantLat),
        restaurantLng: parseFloat(driverMatchForm.restaurantLng),
        riderLat: parseFloat(driverMatchForm.riderLat),
        riderLng: parseFloat(driverMatchForm.riderLng),
        foodPrepEtaMinutes: parseInt(driverMatchForm.foodPrepEtaMinutes)
      });
      setDriverMatchResult(result);
    } catch (err) {
      setDriverMatchError('Failed to compute driver match score: ' + (err.response?.data?.message || err.message));
    } finally {
      setDriverMatchLoading(false);
    }
  };

  // --- OPERATIONAL PROFILE SUBMIT ---
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: '', text: '' });
    try {
      const updated = await restaurantOwnerApi.updateMyProfile(profileForm);
      setProfile(updated);
      setProfileMessage({ type: 'success', text: 'Operational settings saved successfully!' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update operational settings' });
    } finally {
      setProfileLoading(false);
    }
  };

  // --- PROFILE CHANGE REQUEST SUBMIT ---
  const handleChangeRequestSubmit = async (e) => {
    e.preventDefault();
    setChangeRequestMessage({ type: '', text: '' });
    try {
      await restaurantOwnerApi.submitChangeRequest(changeRequestForm);
      setChangeRequestMessage({ type: 'success', text: 'Change request submitted successfully for Admin review!' });
      setShowChangeRequestModal(false);
      setChangeRequestForm({
        requestedRestaurantName: '',
        requestedAddress: '',
        requestedCity: '',
        requestedPincode: '',
        requestedBusinessRegistrationNumber: '',
        requestedFoodLicenseNumber: '',
        reason: ''
      });
      fetchChangeRequests();
    } catch (err) {
      setChangeRequestMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit change request' });
    }
  };

  // --- MENU HANDLERS ---
  const handleOpenAddMenuModal = () => {
    setEditingMenuItem(null);
    setMenuForm({
      name: '',
      description: '',
      price: '',
      category: 'Main Course',
      available: true,
      availableQuantity: ''
    });
    setShowMenuModal(true);
  };

  const handleOpenEditMenuModal = (item) => {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name || '',
      description: item.description || '',
      price: item.price || '',
      category: item.category || 'Main Course',
      available: item.available ?? true,
      availableQuantity: (item.availableQuantity !== null && item.availableQuantity !== undefined) ? item.availableQuantity : ''
    });
    setShowMenuModal(true);
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    setMenuMessage({ type: '', text: '' });

    // Validate availableQuantity
    let parsedQuantity = null;
    if (menuForm.availableQuantity !== '' && menuForm.availableQuantity !== null && menuForm.availableQuantity !== undefined) {
      const valStr = String(menuForm.availableQuantity).trim();
      if (valStr !== '') {
        const qtyNum = Number(valStr);
        if (isNaN(qtyNum)) {
          setMenuMessage({ type: 'error', text: 'Please enter a valid number for available portions.' });
          return;
        }
        if (!Number.isInteger(qtyNum)) {
          setMenuMessage({ type: 'error', text: 'Please enter a whole number of portions.' });
          return;
        }
        if (qtyNum < 0) {
          setMenuMessage({ type: 'error', text: 'Available portions cannot be negative.' });
          return;
        }
        parsedQuantity = qtyNum;
      }
    }

    const payload = {
      name: menuForm.name,
      description: menuForm.description,
      price: parseFloat(menuForm.price),
      category: menuForm.category,
      available: menuForm.available,
      availableQuantity: parsedQuantity
    };

    try {
      if (editingMenuItem) {
        await restaurantOwnerApi.updateMenuItem(editingMenuItem.id, payload);
        setMenuMessage({ type: 'success', text: 'Menu item updated successfully!' });
      } else {
        await restaurantOwnerApi.addMenuItem(payload);
        setMenuMessage({ type: 'success', text: 'New menu item created successfully!' });
      }
      setShowMenuModal(false);
      fetchMenu();
    } catch (err) {
      setMenuMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save menu item' });
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await restaurantOwnerApi.deleteMenuItem(itemId);
      fetchMenu();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete menu item');
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await restaurantOwnerApi.toggleMenuItemAvailability(item.id, !item.available);
      fetchMenu();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update availability');
    }
  };

  // --- ORDER HANDLERS ---
  const handleAcceptOrder = async (orderId) => {
    setOrderActionError('');
    try {
      await restaurantOwnerApi.acceptOrder(orderId);
      fetchOrders();
    } catch (err) {
      setOrderActionError(err.response?.data?.message || 'Failed to accept order');
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!window.confirm('Reject this order?')) return;
    setOrderActionError('');
    try {
      await restaurantOwnerApi.rejectOrder(orderId);
      fetchOrders();
    } catch (err) {
      setOrderActionError(err.response?.data?.message || 'Failed to reject order');
    }
  };

  const handleStartPreparing = async (orderId) => {
    setOrderActionError('');
    try {
      await restaurantOwnerApi.preparingOrder(orderId);
      fetchOrders();
    } catch (err) {
      setOrderActionError(err.response?.data?.message || 'Failed to start preparation');
    }
  };

  const handleMarkReady = async (orderId) => {
    setOrderActionError('');
    try {
      await restaurantOwnerApi.readyOrder(orderId);
      fetchOrders();
    } catch (err) {
      setOrderActionError(err.response?.data?.message || 'Failed to mark order ready');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'NEW':
      case 'CREATED':
        return <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>NEW</span>;
      case 'ACCEPTED':
        return <span style={{ background: '#eab308', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>ACCEPTED</span>;
      case 'PREPARING':
        return <span style={{ background: '#a855f7', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>PREPARING</span>;
      case 'READY':
        return <span style={{ background: '#22c55e', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>READY FOR PICKUP</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span style={{ background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{status}</span>;
      default:
        return <span style={{ background: '#64748b', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Workspace Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏪 {profile?.name || 'Spice Hub'}
          </h1>
          <p style={{ color: 'var(--text-sub)' }}>
            Logged in as {user?.email} | Status: <strong style={{ color: '#22c55e' }}>ACTIVE</strong>
          </p>
        </div>
        <button 
          onClick={() => { fetchProfile(); fetchChangeRequests(); fetchMenu(); fetchOrders(); }}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          🔄 Refresh Workspace
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{ background: activeTab === 'overview' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'overview' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{ background: activeTab === 'profile' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'profile' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          🏢 Profile Governance
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          style={{ background: activeTab === 'menu' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'menu' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          🍕 Menu Management ({menuItems.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{ background: activeTab === 'orders' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'orders' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          📦 Live Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          style={{ background: activeTab === 'ai' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'ai' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          🤖 AI Demand & RDSS Insights
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="metric-grid">
            <div className="metric-card">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Restaurant Status</div>
              <div className="metric-val" style={{ color: 'var(--accent-green)' }}>ACTIVE</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>Admin Verified</div>
            </div>
            <div className="metric-card">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Kitchen Availability</div>
              <div className="metric-val" style={{ color: profile?.open ? '#22c55e' : '#ef4444' }}>
                {profile?.open ? 'OPEN' : 'CLOSED'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>Accepting Live Orders</div>
            </div>
            <div className="metric-card">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Active Menu Items</div>
              <div className="metric-val" style={{ color: 'var(--accent-cyan)' }}>{menuItems.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>{menuItems.filter(i => i.available).length} Available</div>
            </div>
            <div className="metric-card">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Active Orders in Kitchen</div>
              <div className="metric-val" style={{ color: '#f59e0b' }}>
                {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>In Progress Queue</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>📌 Restaurant Identity Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <p><strong>Restaurant Name:</strong> {profile?.name || 'N/A'}</p>
                <p><strong>Cuisine Theme:</strong> {profile?.cuisineType || 'N/A'}</p>
                <p><strong>Registered Address:</strong> {profile?.address || 'N/A'}, {profile?.city} {profile?.pincode}</p>
              </div>
              <div>
                <p><strong>Business Reg No:</strong> {profile?.businessRegistrationNumber || 'REG-TN-2023-889977'}</p>
                <p><strong>FSSAI / Food License:</strong> {profile?.foodLicenseNumber || 'FSSAI-11223344556677'}</p>
                <p><strong>Operating Hours:</strong> {profile?.openingTime || '10:00 AM'} – {profile?.closingTime || '10:00 PM'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE GOVERNANCE (3 TIERS) */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* TIER 1: LOCKED FIELDS */}
          <div className="card" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔒 Tier 1: System & Security Information (Read-Only)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
              System identities, ownership references, and Admin approval records are strictly immutable.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>User ID (Auth Service)</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px' }}>{user?.id || profile?.ownerId || 'U101'} 🔒</div>
              </div>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Restaurant ID (Domain Service)</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px' }}>{profile?.id || 'R501'} 🔒</div>
              </div>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Owner ID Logical Mapping</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px' }}>{profile?.ownerId || user?.id || 'U101'} 🔒</div>
              </div>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>System Role & Account Status</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px', color: '#22c55e' }}>RESTAURANT_OWNER • ACTIVE 🔒</div>
              </div>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Owner Registered Email</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px' }}>{user?.email || profile?.ownerEmail} 🔒</div>
              </div>
              <div style={{ background: '#1e293b', padding: '0.8rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Approval Verification</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px' }}>ADMIN VERIFIED 🔒</div>
              </div>
            </div>
          </div>

          {/* TIER 2: DIRECTLY EDITABLE OPERATIONAL SETTINGS */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✏️ Tier 2: Directly Editable Operational Settings
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
              Update your daily kitchen operational details, operating hours, phone numbers, and active availability switch.
            </p>

            {profileMessage.text && (
              <div style={{ padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', background: profileMessage.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: profileMessage.type === 'success' ? '#22c55e' : '#ef4444' }}>
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Kitchen Contact Phone</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Desk Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Cuisine Category</label>
                  <input
                    type="text"
                    value={profileForm.cuisineType}
                    onChange={(e) => setProfileForm({ ...profileForm, cuisineType: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Description / Story</label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Opening Time</label>
                  <input
                    type="time"
                    value={profileForm.openingTime}
                    onChange={(e) => setProfileForm({ ...profileForm, openingTime: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Closing Time</label>
                  <input
                    type="time"
                    value={profileForm.closingTime}
                    onChange={(e) => setProfileForm({ ...profileForm, closingTime: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Logo / Image URL</label>
                  <input
                    type="text"
                    value={profileForm.logoUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="open-check"
                  checked={profileForm.open}
                  onChange={(e) => setProfileForm({ ...profileForm, open: e.target.checked })}
                />
                <label htmlFor="open-check" style={{ fontSize: '0.9rem', color: '#fff', cursor: 'pointer' }}>
                  <strong>Kitchen Currently Open:</strong> Accepting customer orders on the SmartEats storefront.
                </label>
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 700, padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                {profileLoading ? 'Saving...' : 'Save Operational Changes'}
              </button>
            </form>
          </div>

          {/* TIER 3: MAJOR IDENTITY CHANGES (CHANGE REQUEST MECHANISM) */}
          <div className="card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                📋 Tier 3: Major Identity Changes (Admin Approval Required)
              </h3>
              <button
                onClick={() => setShowChangeRequestModal(true)}
                style={{ background: '#f59e0b', border: 'none', color: '#000', fontWeight: 700, padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                ➕ Request Profile Change
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
              Modifications to Restaurant Name, Registered Address, City/Pincode, and Food/FSSAI License require Administrator verification before updating your live profile.
            </p>

            {/* Change Requests History */}
            {changeRequests.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>No profile change requests submitted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {changeRequests.map((req) => (
                  <div key={req.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold' }}>Change Request #{req.id?.substring(0, 8)}</span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: req.status === 'APPROVED' ? 'rgba(34,197,94,0.2)' : (req.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'),
                        color: req.status === 'APPROVED' ? '#22c55e' : (req.status === 'REJECTED' ? '#ef4444' : '#f59e0b')
                      }}>
                        {req.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                      {req.requestedRestaurantName && <p style={{ margin: '2px 0' }}>• Requested Name: <strong>{req.requestedRestaurantName}</strong></p>}
                      {req.requestedAddress && <p style={{ margin: '2px 0' }}>• Requested Address: <strong>{req.requestedAddress} ({req.requestedCity}, {req.requestedPincode})</strong></p>}
                      {req.requestedBusinessRegistrationNumber && <p style={{ margin: '2px 0' }}>• Requested Reg No: <strong>{req.requestedBusinessRegistrationNumber}</strong></p>}
                      {req.requestedFoodLicenseNumber && <p style={{ margin: '2px 0' }}>• Requested License No: <strong>{req.requestedFoodLicenseNumber}</strong></p>}
                      {req.reason && <p style={{ margin: '2px 0', fontStyle: 'italic' }}>Reason: "{req.reason}"</p>}
                      {req.adminFeedback && <p style={{ margin: '4px 0', color: '#ef4444' }}>Admin Feedback: "{req.adminFeedback}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PROFILE CHANGE REQUEST MODAL */}
          {showChangeRequestModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: '520px', maxWidth: '90%' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', marginBottom: '0.8rem' }}>
                  📋 Request Major Identity Changes
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                  Fill in the fields you wish to update. An Administrator will review your request.
                </p>

                <form onSubmit={handleChangeRequestSubmit}>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>New Restaurant Name (Leave blank if unchanged)</label>
                    <input
                      type="text"
                      value={changeRequestForm.requestedRestaurantName}
                      onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedRestaurantName: e.target.value })}
                      placeholder="e.g. Spice Hub Gourmet Bistro"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                  </div>

                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>New Physical Address</label>
                    <input
                      type="text"
                      value={changeRequestForm.requestedAddress}
                      onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedAddress: e.target.value })}
                      placeholder="e.g. 104 Katpadi Bypass Road"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City</label>
                      <input
                        type="text"
                        value={changeRequestForm.requestedCity}
                        onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedCity: e.target.value })}
                        placeholder="Vellore"
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Pincode</label>
                      <input
                        type="text"
                        value={changeRequestForm.requestedPincode}
                        onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedPincode: e.target.value })}
                        placeholder="632007"
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Updated FSSAI / Food License Number</label>
                    <input
                      type="text"
                      value={changeRequestForm.requestedFoodLicenseNumber}
                      onChange={(e) => setChangeRequestForm({ ...changeRequestForm, requestedFoodLicenseNumber: e.target.value })}
                      placeholder="FSSAI-99887766554433"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rationale / Reason for Change *</label>
                    <textarea
                      required
                      value={changeRequestForm.reason}
                      onChange={(e) => setChangeRequestForm({ ...changeRequestForm, reason: e.target.value })}
                      placeholder="e.g. Relocated to a larger dining location with renewed FSSAI certification."
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minHeight: '50px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowChangeRequestModal(false)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ background: '#f59e0b', border: 'none', color: '#000', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Submit for Admin Review
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MENU MANAGEMENT */}
      {activeTab === 'menu' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)' }}>🍕 Menu Items Management</h2>
            <button
              onClick={handleOpenAddMenuModal}
              style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              ➕ Add New Menu Item
            </button>
          </div>

          {menuMessage.text && (
            <div style={{ padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', background: menuMessage.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: menuMessage.type === 'success' ? '#22c55e' : '#ef4444' }}>
              {menuMessage.text}
            </div>
          )}

          {menuLoading ? (
            <p>Loading menu items...</p>
          ) : menuItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-sub)' }}>No menu items created yet.</p>
              <button
                onClick={handleOpenAddMenuModal}
                style={{ marginTop: '1rem', background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                Create Your First Item
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {menuItems.map((item) => (
                <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{item.name}</h4>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>₹{item.price}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '4px 0 6px 0', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                        {item.category}
                      </span>

                      {/* Portion Inventory Badge */}
                      {item.availableQuantity === null || item.availableQuantity === undefined ? (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ⚪ Portions not configured
                        </span>
                      ) : item.availableQuantity === 0 ? (
                        <span style={{ fontSize: '0.72rem', color: '#ef4444', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          🔴 Sold Out (0 portions)
                        </span>
                      ) : item.availableQuantity === 1 ? (
                        <span style={{ fontSize: '0.72rem', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          ⚠️ 1 portion left
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          🟢 {item.availableQuantity} portions available
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', minHeight: '40px' }}>{item.description}</p>
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      style={{
                        background: item.available ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: item.available ? '#22c55e' : '#ef4444',
                        border: '1px solid ' + (item.available ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {item.available ? '🟢 Available' : '🔴 Unavailable'}
                    </button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleOpenEditMenuModal(item)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                      <button onClick={() => handleDeleteMenuItem(item.id)} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MENU ITEM MODAL */}
          {showMenuModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="card" style={{ width: '450px', maxWidth: '90%' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>
                  {editingMenuItem ? '✏️ Edit Menu Item' : '➕ Create New Menu Item'}
                </h3>
                <form onSubmit={handleMenuSubmit}>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Food Name</label>
                    <input
                      type="text"
                      required
                      value={menuForm.name}
                      onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                  </div>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Description</label>
                    <textarea
                      required
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minHeight: '60px' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Category</label>
                      <select
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      >
                        <option value="Starters" style={{ background: '#1e293b' }}>Starters</option>
                        <option value="Main Course" style={{ background: '#1e293b' }}>Main Course</option>
                        <option value="Desserts" style={{ background: '#1e293b' }}>Desserts</option>
                        <option value="Beverages" style={{ background: '#1e293b' }}>Beverages</option>
                        <option value="Biryani & Rice" style={{ background: '#1e293b' }}>Biryani & Rice</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '4px' }}>
                      Available Portions
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 20 (leave empty if unconfigured)"
                      value={menuForm.availableQuantity}
                      onChange={(e) => setMenuForm({ ...menuForm, availableQuantity: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'block', marginTop: '3px' }}>
                      Number of sellable food portions currently prepared and ready for ordering.
                    </span>
                  </div>

                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="available-check"
                      checked={menuForm.available}
                      onChange={(e) => setMenuForm({ ...menuForm, available: e.target.checked })}
                    />
                    <label htmlFor="available-check" style={{ fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>Available for ordering right now</label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowMenuModal(false)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Save Item
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE ORDERS MANAGEMENT */}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>📦 Restaurant Orders Queue</h2>

          {orderActionError && (
            <div style={{ padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              ❌ {orderActionError}
            </div>
          )}

          {ordersLoading ? (
            <p>Loading orders...</p>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-sub)' }}>No active orders found for your restaurant.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders.map((ord) => (
                <div key={ord.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Order #{ord.id?.substring(0, 8)}...</span>
                      {getStatusBadge(ord.status)}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: '4px 0' }}>
                      Customer: <strong>{ord.customerEmail}</strong> | Total: <strong style={{ color: 'var(--accent-cyan)' }}>₹{ord.totalAmount}</strong>
                    </p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '6px' }}>
                      Items: {ord.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'N/A'}
                    </div>

                    {/* Assigned Driver & Calling Info (Step 8.4B) */}
                    {(() => {
                      const delivery = deliveriesByOrderId[ord.id];
                      const hasAssignedDriver = delivery && (delivery.driverPhone || delivery.deliveryPartnerEmail);
                      if (hasAssignedDriver) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', color: '#00f2fe', fontWeight: 600 }}>
                              🛵 Driver: {delivery.driverName || delivery.deliveryPartnerEmail}
                            </span>
                            {cleanTelUri(delivery.driverPhone) ? (
                              <a
                                href={cleanTelUri(delivery.driverPhone)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  color: '#22c55e',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  cursor: 'pointer'
                                }}
                                title={`Call driver at ${formatIndianPhone(delivery.driverPhone)}`}
                              >
                                📞 Call Driver
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                                {delivery.driverPhone ? formatIndianPhone(delivery.driverPhone) : 'Driver phone not available'}
                              </span>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '4px' }}>
                            🛵 Driver: <span style={{ color: '#94a3b8' }}>Not assigned</span>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* ORDER STATE MACHINE ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(ord.status === 'NEW' || ord.status === 'CREATED') && (
                      <>
                        <button
                          onClick={() => handleAcceptOrder(ord.id)}
                          style={{ background: '#22c55e', border: 'none', color: '#fff', fontWeight: 'bold', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          ✅ Accept Order
                        </button>
                        <button
                          onClick={() => handleRejectOrder(ord.id)}
                          style={{ background: '#ef4444', border: 'none', color: '#fff', fontWeight: 'bold', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          ❌ Reject Order
                        </button>
                      </>
                    )}

                    {ord.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleStartPreparing(ord.id)}
                        style={{ background: '#a855f7', border: 'none', color: '#fff', fontWeight: 'bold', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        👨‍🍳 Start Preparation
                      </button>
                    )}

                    {ord.status === 'PREPARING' && (
                      <button
                        onClick={() => handleMarkReady(ord.id)}
                        style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 'bold', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        🔔 Mark Food Ready
                      </button>
                    )}

                    {ord.status === 'READY' && (
                      <span style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: 'bold' }}>Waiting for Pickup</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI DEMAND & RDSS INSIGHTS */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* SECTION 1: 24-HOUR DEMAND FORECASTING */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0 }}>📈 AI 24-Hour Demand Forecast</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: '4px 0 0 0' }}>
                  ML-driven meal demand predictions generated by FastAPI AI Engine (`/api/rdss/forecast`)
                </p>
              </div>
              <button
                onClick={fetchForecast}
                disabled={forecastLoading}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                {forecastLoading ? '⏳ Fetching...' : '🔄 Refresh Forecast'}
              </button>
            </div>

            {forecastError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                ⚠️ {forecastError}
              </div>
            )}

            {forecastLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-sub)' }}>
                ⏳ Connecting to AI Service & generating hourly forecast...
              </div>
            ) : forecastData ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Restaurant ID</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{forecastData.restaurantId}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Forecast Date</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{forecastData.forecastDate}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Total Forecasted Meals</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>{forecastData.totalForecastedMeals} units</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>AI Model Confidence</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>
                      {forecastData.confidenceScore ? `${(forecastData.confidenceScore * 100).toFixed(0)}%` : '92%'}
                    </div>
                  </div>
                </div>

                {/* Hourly Forecast Visual Breakdown */}
                <h4 style={{ color: 'var(--text-sub)', marginBottom: '0.75rem' }}>Hourly Meal Demand Breakdown:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                  {forecastData.hourlyForecast?.map((item, idx) => {
                    const hourLabel = item.time || item.hour || `${idx}:00`;
                    const demandVal = item.predictedOrders ?? item.predictedDemand ?? 0;
                    return (
                      <div key={hourLabel} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{hourLabel}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: demandVal > 15 ? 'var(--accent-cyan)' : '#e2e8f0', margin: '4px 0' }}>
                          {demandVal}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)' }}>meals</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* SECTION 2: SURPLUS & WASTE MITIGATION */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>🌱 Surplus Food & Waste Mitigation Engine</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
              Analyze inventory velocity to calculate dynamic discount rates and prevent food waste (`/api/rdss/surplus-check`).
            </p>

            <form onSubmit={handleRunSurplusCheck} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Menu Item ID</label>
                <input
                  type="text"
                  value={surplusForm.menuItemId}
                  onChange={(e) => setSurplusForm({ ...surplusForm, menuItemId: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Current Inventory Count</label>
                <input
                  type="number"
                  value={surplusForm.inventoryCount}
                  onChange={(e) => setSurplusForm({ ...surplusForm, inventoryCount: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Sales Velocity (units/hr)</label>
                <input
                  type="number"
                  step="0.1"
                  value={surplusForm.salesVelocityPerHour}
                  onChange={(e) => setSurplusForm({ ...surplusForm, salesVelocityPerHour: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Hours Left in Business Day</label>
                <input
                  type="number"
                  step="0.5"
                  value={surplusForm.hoursLeftInDay}
                  onChange={(e) => setSurplusForm({ ...surplusForm, hoursLeftInDay: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Original Unit Price (₹)</label>
                <input
                  type="number"
                  value={surplusForm.originalPrice}
                  onChange={(e) => setSurplusForm({ ...surplusForm, originalPrice: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={surplusLoading}
                  style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 'bold', padding: '0.7rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {surplusLoading ? '⏳ Running AI Model...' : '⚡ Run AI Surplus Evaluation'}
                </button>
              </div>
            </form>

            {surplusError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '0.8rem', borderRadius: '6px', marginTop: '1rem' }}>
                ⚠️ {surplusError}
              </div>
            )}

            {surplusResult && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: (surplusResult.surplusDetected ?? surplusResult.isSurplus) ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)', border: `1px solid ${(surplusResult.surplusDetected ?? surplusResult.isSurplus) ? '#22c55e' : 'rgba(255,255,255,0.1)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{(surplusResult.surplusDetected ?? surplusResult.isSurplus) ? '⚠️ SURPLUS DETECTED' : '✅ OPTIMAL INVENTORY'}</span>
                  <span style={{ fontSize: '0.8rem', color: (surplusResult.surplusDetected ?? surplusResult.isSurplus) ? '#22c55e' : '#94a3b8' }}>
                    ({surplusResult.surplusUnits ?? surplusResult.estimatedSurplusUnits ?? 0} excess units predicted)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Dynamic Discount</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#22c55e' }}>
                      {surplusResult.discountPercent ?? surplusResult.suggestedDiscountPercent ?? 0}% OFF
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Discounted Price</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>₹{surplusResult.discountedPrice}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Est. Waste Prevented</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f59e0b' }}>
                      {surplusResult.estimatedWastePreventedKg ?? surplusResult.wastePreventedKg ?? 0} kg
                    </div>
                  </div>
                </div>
                {(surplusResult.recommendedAction || surplusResult.recommendation) && (
                  <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: '#e2e8f0', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.8rem', borderRadius: '4px' }}>
                    💡 <strong>Recommendation:</strong> {surplusResult.recommendedAction || surplusResult.recommendation}
                    {surplusResult.ngoPartner ? ` (Suggested NGO Partner: ${surplusResult.ngoPartner})` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: PROXIMITY DRIVER MATCH SCORING */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>🛵 AI Driver Proximity & Dispatch Matcher</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
              Computes spatial-temporal dispatch score using Haversine & food preparation ETA (`/api/rdss/match-driver`).
            </p>

            <form onSubmit={handleRunDriverMatch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Order ID</label>
                <input
                  type="text"
                  value={driverMatchForm.orderId}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, orderId: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rest. Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={driverMatchForm.restaurantLat}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, restaurantLat: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rest. Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={driverMatchForm.restaurantLng}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, restaurantLng: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rider Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={driverMatchForm.riderLat}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, riderLat: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rider Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={driverMatchForm.riderLng}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, riderLng: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Prep ETA (mins)</label>
                <input
                  type="number"
                  value={driverMatchForm.foodPrepEtaMinutes}
                  onChange={(e) => setDriverMatchForm({ ...driverMatchForm, foodPrepEtaMinutes: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                  required
                />
              </div>
              <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={driverMatchLoading}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 'bold', padding: '0.7rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {driverMatchLoading ? '⏳ Computing Score...' : '🎯 Compute AI Match Score'}
                </button>
              </div>
            </form>

            {driverMatchError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '0.8rem', borderRadius: '6px', marginTop: '1rem' }}>
                ⚠️ {driverMatchError}
              </div>
            )}

            {driverMatchResult && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Distance to Restaurant</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                      {driverMatchResult.distanceKm?.toFixed(2)} km
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>AI Match Score</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: driverMatchResult.matchingScorePercent > 70 ? '#22c55e' : '#f59e0b' }}>
                      {driverMatchResult.matchingScorePercent}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Status</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>
                      {driverMatchResult.recommended ? '✅ RECOMMENDED ASSIGNMENT' : '⚠️ HIGH DISTANCE / DELAY'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
