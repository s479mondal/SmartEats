import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rescueApi, orderApi } from '../api/orderApi';
import { restaurantApi } from '../api/restaurantApi';
import RestaurantCard from './restaurant/RestaurantCard';
import OrderTrackingView from './customer/OrderTrackingView';
import { getCustomerAvailabilityStatus, checkCartItemInventory } from '../utils/inventoryUtils';
import { initiateRazorpayCheckout } from '../utils/razorpayUtils';
import { computeCombinedOrderStatus, ORDER_STATUS_MAP, formatOrderTimestamp } from '../utils/orderStatusUtils';

export default function CustomerPortal({ cart = [], setCart, addToCart, updateCartQty, removeFromCart }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [menuItems, setMenuItems] = useState([]);
  const [rescueOffers, setRescueOffers] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [trackingModalOrderId, setTrackingModalOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutStatusMsg, setCheckoutStatusMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY'); // 'RAZORPAY' | 'COD'

  // Discovery Mode State
  const [discoveryMode, setDiscoveryMode] = useState('NEARBY'); // 'NEARBY' | 'ALL'
  const [radius, setRadius] = useState(5); // 5, 10, 20, 50 km
  const [discoveredRestaurants, setDiscoveredRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantsError, setRestaurantsError] = useState(null);

  // Customer stored coordinates extraction
  const customerLat = user?.customerLatitude ?? user?.latitude;
  const customerLng = user?.customerLongitude ?? user?.longitude;
  const hasValidCoordinates = (
    customerLat !== null &&
    customerLat !== undefined &&
    customerLng !== null &&
    customerLng !== undefined &&
    !isNaN(Number(customerLat)) &&
    !isNaN(Number(customerLng)) &&
    Number(customerLat) !== 0 &&
    Number(customerLng) !== 0
  );

  // Initial Load: Menu items, rescue offers, and customer orders
  useEffect(() => {
    Promise.all([
      restaurantApi.getMenu('all').catch(() => []),
      rescueApi.getRescueOffers().catch(() => []),
      orderApi.getCustomerOrders().catch(() => [])
    ]).then(([menuRes, rescueRes, ordersRes]) => {
      setMenuItems(menuRes?.data || menuRes || []);
      setRescueOffers(rescueRes?.data || rescueRes || []);
      const fetchedOrders = ordersRes?.data || ordersRes || [];
      setCustomerOrders(Array.isArray(fetchedOrders) ? fetchedOrders : []);
      if (Array.isArray(fetchedOrders) && fetchedOrders.length > 0) {
        const active = fetchedOrders.find(
          o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
        );
        if (active) setActiveOrder(active);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Polling for active orders (every 8 seconds when active order exists)
  useEffect(() => {
    const hasActive = customerOrders.some(
      o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      orderApi.getCustomerOrders().then((ordersRes) => {
        const fetchedOrders = ordersRes?.data || ordersRes || [];
        if (Array.isArray(fetchedOrders)) {
          setCustomerOrders(fetchedOrders);
          const active = fetchedOrders.find(
            o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
          );
          setActiveOrder(active || null);
        }
      }).catch((err) => {
        console.warn('Customer active orders polling warning:', err);
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [customerOrders]);

  // Fetch Restaurants based on Discovery Mode & Radius
  useEffect(() => {
    let isMounted = true;
    const fetchRestaurants = async () => {
      setRestaurantsLoading(true);
      setRestaurantsError(null);

      try {
        if (discoveryMode === 'NEARBY') {
          if (!hasValidCoordinates) {
            // Do NOT call the nearby API when coordinates are missing
            setDiscoveredRestaurants([]);
            setRestaurantsLoading(false);
            return;
          }
          const data = await restaurantApi.getNearbyRestaurants(
            Number(customerLat),
            Number(customerLng),
            radius
          );
          if (isMounted) {
            setDiscoveredRestaurants(Array.isArray(data) ? data : []);
          }
        } else {
          // 'ALL' Mode: fetch all approved restaurants
          const data = await restaurantApi.getRestaurants();
          if (isMounted) {
            setDiscoveredRestaurants(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load restaurants:', err);
          setRestaurantsError('Unable to load restaurants. Please try again later.');
          setDiscoveredRestaurants([]);
        }
      } finally {
        if (isMounted) {
          setRestaurantsLoading(false);
        }
      }
    };

    fetchRestaurants();

    return () => {
      isMounted = false;
    };
  }, [discoveryMode, radius, hasValidCoordinates, customerLat, customerLng]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || 
                            (activeCategory === 'SURPLUS' && item.isSurplus) ||
                            item.category?.toUpperCase() === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Map for O(1) inventory lookup
  const menuItemsMap = React.useMemo(() => {
    return new Map((menuItems || []).map((m) => [m.id || m._id, m]));
  }, [menuItems]);

  // Check if cart has stale inventory overloads
  const hasStaleCartIssues = React.useMemo(() => {
    if (!cart || cart.length === 0) return false;
    return cart.some((cartItem) => {
      const menuItem = menuItemsMap.get(cartItem.id || cartItem._id) || cartItem;
      const check = checkCartItemInventory(cartItem, menuItem);
      return check.isOverload || check.isSoldOut;
    });
  }, [cart, menuItemsMap]);

  const cartTotal = (cart || []).reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);

  const handleCheckout = async () => {
    if (!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut) return;

    const effectiveRestaurantId = cart[0]?.restaurantId || '';
    const cartPayload = {
      restaurantId: effectiveRestaurantId,
      items: cart.map((i) => ({
        menuItemId: i.menuItemId || i.id || i._id,
        name: i.name || 'Food Item',
        price: Number(i.price) || 0,
        quantity: i.qty || i.quantity || 1
      }))
    };

    // Generate cryptographically unique idempotency key for this checkout attempt
    const checkoutKey = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (paymentMethod === 'COD') {
      setIsCheckingOut(true);
      setCheckoutStatusMsg('Placing Cash on Delivery Order...');
      try {
        const orderResponse = await orderApi.placeCodOrder(checkoutKey, cartPayload);
        const confirmedOrder = {
          id: orderResponse.id,
          status: orderResponse.status || 'CREATED',
          paymentStatus: orderResponse.paymentStatus || 'PENDING',
          paymentMethod: 'COD',
          totalAmount: orderResponse.totalAmount || cartTotal,
          items: cart,
          etaMinutes: 28,
          createdAt: orderResponse.createdAt || new Date().toISOString()
        };
        alert(`Order Placed Successfully! 🎉\n\nOrder ID: ${orderResponse.id}\nPayment Method: Cash on Delivery\nPayment Status: Pending\nOrder Status: Confirmed (CREATED)`);
        setActiveOrder(confirmedOrder);
        setCustomerOrders(prev => [confirmedOrder, ...prev]);
        if (typeof clearCart === 'function') {
          clearCart();
        } else if (setCart) {
          setCart([]);
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to place Cash on Delivery order.';
        alert(msg);
      } finally {
        setIsCheckingOut(false);
        setCheckoutStatusMsg('');
      }
      return;
    }

    // Razorpay Online Flow
    await initiateRazorpayCheckout({
      user,
      idempotencyKey: checkoutKey,
      cart,
      restaurantId: effectiveRestaurantId,
      cartPayload,
      onLoadingChange: (loading, msg) => {
        setIsCheckingOut(loading);
        setCheckoutStatusMsg(msg || '');
      },
      onSuccess: (paymentResult) => {
        const confirmedOrder = {
          id: paymentResult.orderId,
          status: paymentResult.orderStatus || 'CREATED',
          paymentStatus: paymentResult.paymentStatus || 'PAID',
          paymentMethod: 'RAZORPAY',
          totalAmount: paymentResult.amount,
          items: cart,
          etaMinutes: 28,
          createdAt: new Date().toISOString()
        };
        alert(`Order Confirmed & Paid Successfully! 🎉\n\nOrder ID: ${paymentResult.orderId}\nPayment Status: PAID\nOrder Status: CREATED`);
        setActiveOrder(confirmedOrder);
        setCustomerOrders(prev => [confirmedOrder, ...prev]);
        if (typeof clearCart === 'function') {
          clearCart();
        } else if (setCart) {
          setCart([]);
        }
      },
      onFailure: (errorMsg) => {
        alert(errorMsg);
      },
      onDismiss: (dismissMsg) => {
        alert(dismissMsg);
      }
    });
  };

  return (
    <div>
      {/* Customer Personal Greeting */}
      <div className="hero-banner" style={{ padding: '2.5rem 2rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="hero-title">Hello, {user?.name || 'Customer'} 👋</h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', marginTop: '0.4rem' }}>
            What are you craving today?
          </p>
          <div style={{ marginTop: '1.2rem', maxWidth: '500px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search food or restaurant..."
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid var(--bg-card-border)',
                color: '#fff',
                padding: '0.8rem 1.2rem',
                borderRadius: '12px',
                fontFamily: 'var(--font-body)'
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: '5rem' }}>🍛</div>
      </div>

      {/* Recommended For You Category Bar */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>
          Recommended For You
        </h2>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {[
            { title: '🍽️ All Dishes', cat: 'ALL' },
            { title: '🍛 Paneer Biryani', cat: 'MAIN_COURSE' },
            { title: '🍕 Pizza', cat: 'PIZZA' },
            { title: '🥗 Healthy Meals', cat: 'HEALTHY' },
            { title: '🍔 Gourmet Burgers', cat: 'BURGER' }
          ].map((rec, i) => (
            <button
              key={i}
              className={`cat-btn ${activeCategory === rec.cat ? 'active' : ''}`}
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', flexShrink: 0 }}
              onClick={() => setActiveCategory(rec.cat)}
            >
              {rec.title}
            </button>
          ))}
        </div>
      </div>

      {/* Active Order Banner with Live Progress */}
      {activeOrder && (() => {
        const combined = computeCombinedOrderStatus(activeOrder);
        return (
          <div className="card" style={{
            marginBottom: '2.5rem',
            borderColor: combined.isError ? '#ef4444' : 'var(--accent-cyan)',
            background: combined.isError ? 'rgba(239, 68, 68, 0.06)' : 'rgba(0, 242, 254, 0.05)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
                  <span className="badge badge-ai" style={{ background: combined.badgeColor, color: combined.isDelivered ? '#fff' : '#000' }}>
                    {combined.currentLabel}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                    ● Live Tracking Active
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', margin: '4px 0', fontSize: '1.25rem' }}>
                  Order #{activeOrder.id ? activeOrder.id.substring(0, 10) : '---'}
                </h3>
                <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '2px', marginBottom: '8px' }}>
                  {combined.currentDescription} • Placed {formatOrderTimestamp(activeOrder.createdAt)}
                </p>

                {/* Mini Progress Bar */}
                <div style={{
                  width: '100%',
                  maxWidth: '380px',
                  height: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${combined.progressPct}%`,
                    height: '100%',
                    background: 'var(--primary-gradient)',
                    borderRadius: '10px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setTrackingModalOrderId(activeOrder.id)}
                  className="btn-action"
                  style={{
                    textDecoration: 'none',
                    padding: '0.7rem 1.4rem',
                    width: 'auto',
                    margin: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <span>🧭 Track Order Live</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Restaurant Discovery & Proximity Section (Step 7 Core Feature) */}
      <div className="card" style={{ marginBottom: '2.5rem', borderColor: 'rgba(0, 242, 254, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
              <span className="badge badge-ai">
                {discoveryMode === 'NEARBY' ? '📍 Proximity Discovery' : '🌐 All Directory'}
              </span>
              {discoveryMode === 'NEARBY' && hasValidCoordinates && (
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                  ● GPS Grounded
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem' }}>
              Discover Restaurants
            </h2>
            {discoveryMode === 'NEARBY' && hasValidCoordinates && (
              <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '4px' }}>
                Showing restaurants within <strong>{radius} km</strong> of your saved address ({user?.address || user?.city || `${Number(customerLat).toFixed(3)}, ${Number(customerLng).toFixed(3)}`})
              </p>
            )}
          </div>

          {/* Mode Switcher: Nearby vs All */}
          <div className="role-nav">
            <button
              className={`role-btn ${discoveryMode === 'NEARBY' ? 'active' : ''}`}
              onClick={() => setDiscoveryMode('NEARBY')}
            >
              📍 Nearby Restaurants
            </button>
            <button
              className={`role-btn ${discoveryMode === 'ALL' ? 'active' : ''}`}
              onClick={() => setDiscoveryMode('ALL')}
            >
              🌐 All Restaurants
            </button>
          </div>
        </div>

        {/* Radius Selector Pills (Visible in NEARBY mode when coordinates present) */}
        {discoveryMode === 'NEARBY' && hasValidCoordinates && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid var(--bg-card-border)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 600 }}>
              Search Radius:
            </span>
            {[5, 10, 20, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                style={{
                  background: radius === r ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.05)',
                  color: radius === r ? '#fff' : 'var(--text-sub)',
                  border: radius === r ? 'none' : '1px solid var(--bg-card-border)',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: radius === r ? '0 2px 10px rgba(255, 94, 58, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {r} km {r === 5 ? '(Default)' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Missing Customer Coordinates View (Strictly handled, NO fake coordinates) */}
        {discoveryMode === 'NEARBY' && !hasValidCoordinates && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: '#f8fafc'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>📍</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
              Your location is not available. Please update your address to discover nearby restaurants.
            </h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', maxWidth: '540px', margin: '0 auto 1.5rem auto', lineHeight: '1.6' }}>
              SmartEats uses your stored profile coordinates from registration to discover kitchen partners near you. Please update your address details or browse the full restaurant directory.
            </p>
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setDiscoveryMode('ALL')}
                className="cat-btn"
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', padding: '0.6rem 1.4rem' }}
              >
                Browse All Restaurants
              </button>
              <Link
                to="/customer/preferences"
                className="btn-action"
                style={{ width: 'auto', padding: '0.6rem 1.4rem', marginTop: 0, textDecoration: 'none', display: 'inline-block' }}
              >
                Manage Preferences
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {restaurantsLoading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-sub)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.6rem' }}>⏳</div>
            <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {discoveryMode === 'NEARBY'
                ? `Searching restaurants within ${radius} km of your coordinates...`
                : 'Loading approved restaurant directory...'}
            </p>
          </div>
        )}

        {/* Error State */}
        {!restaurantsLoading && restaurantsError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '1.8rem',
            textAlign: 'center',
            color: '#f87171'
          }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{restaurantsError}</p>
            <button
              onClick={() => setDiscoveryMode(discoveryMode === 'NEARBY' ? 'ALL' : 'NEARBY')}
              className="cat-btn"
              style={{ marginTop: '0.8rem' }}
            >
              Switch Mode / Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!restaurantsLoading && !restaurantsError && (discoveryMode === 'ALL' || hasValidCoordinates) && discoveredRestaurants.length === 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--bg-card-border)',
            borderRadius: '16px',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-sub)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🍽️</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
              {discoveryMode === 'NEARBY'
                ? `No restaurants found within ${radius} km.`
                : 'No approved restaurants found.'}
            </h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto' }}>
              {discoveryMode === 'NEARBY'
                ? 'Try expanding your search radius to 10 km, 20 km, or 50 km to discover more kitchens in your city.'
                : 'Check back soon as new kitchen partners join the SmartEats network.'}
            </p>
            {discoveryMode === 'NEARBY' && radius < 50 && (
              <button
                onClick={() => setRadius(r => r === 5 ? 10 : (r === 10 ? 20 : 50))}
                className="cat-btn"
                style={{ marginTop: '1.2rem', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)' }}
              >
                Expand Search Radius →
              </button>
            )}
          </div>
        )}

        {/* Discovered Restaurants Grid */}
        {!restaurantsLoading && !restaurantsError && (discoveryMode === 'ALL' || hasValidCoordinates) && discoveredRestaurants.length > 0 && (
          <div className="grid-3">
            {discoveredRestaurants
              .filter(r => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  r.name?.toLowerCase().includes(q) ||
                  r.cuisineType?.toLowerCase().includes(q) ||
                  r.cuisine?.toLowerCase().includes(q) ||
                  r.address?.toLowerCase().includes(q) ||
                  r.city?.toLowerCase().includes(q)
                );
              })
              .map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id || restaurant._id}
                  restaurant={restaurant}
                  dark={true}
                />
              ))}
          </div>
        )}
      </div>

      {/* Food Rescue Near You Section */}
      <div className="card" style={{ marginBottom: '2.5rem', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <div>
            <span className="badge badge-surplus">♻️ Food Rescue Near You</span>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', marginTop: '0.4rem' }}>Limited-Time Offers</h2>
          </div>
          <Link to="/customer/rescue" className="cat-btn" style={{ textDecoration: 'none' }}>View All →</Link>
        </div>

        <div className="grid-3">
          {rescueOffers.length === 0 ? (
            <div className="card" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-sub)' }}>
              No active food rescue offers currently available.
            </div>
          ) : (
            rescueOffers.slice(0, 3).map((offer) => (
              <div key={offer.id || offer._id} className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <span className="badge badge-surplus">{offer.discountPct || 50}% OFF</span>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginTop: '0.5rem' }}>{offer.name}</h3>
                <div style={{ margin: '0.5rem 0' }}>
                  {offer.originalPrice && <span className="price-old">₹{offer.originalPrice}</span>}
                  <span style={{ color: 'var(--accent-green)', fontWeight: 800, fontSize: '1.3rem' }}>₹{offer.rescuePrice || offer.price}</span>
                </div>
                <p style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700 }}>⏳ Expires in {offer.expiresMinutes || 25} min</p>
                <button className="btn-action" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginTop: '0.8rem' }} onClick={() => addToCart(offer)}>
                  Get Offer
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Grid: Food Menu & Cart */}
      <div className="grid-2">
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Fresh Dishes & Menu</h2>
          {loading ? (
            <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '2rem 0' }}>Loading fresh dishes...</div>
          ) : (
            <div className="grid-3">
              {filteredItems.map((item) => {
                const itemId = item.id || item._id;
                const status = getCustomerAvailabilityStatus(item);
                const isAvailable = status.isOrderable;
                const currentCartItem = (cart || []).find((i) => (i.id || i._id) === itemId);
                const inCartQty = currentCartItem ? (currentCartItem.qty || 1) : 0;
                const isMaxInCart = item.availableQuantity !== null && item.availableQuantity !== undefined && inCartQty >= Number(item.availableQuantity);

                return (
                  <div key={itemId} className="card" style={{ display: 'flex', flexDirection: 'column', opacity: isAvailable ? 1 : 0.65 }}>
                    {item.img && <img src={item.img} className="food-img" alt={item.name} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: status.badgeColor,
                          background: status.bgColor,
                          border: `1px solid ${status.borderColor}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {status.icon} {status.label}
                      </span>
                    </div>

                    <div className="food-header">
                      <div className="food-title">{item.name}</div>
                      <div className="price-tag">₹{item.price}</div>
                    </div>
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '0.8rem', flexGrow: 1 }}>
                      {item.description || item.desc}
                    </p>
                    <button
                      className="btn-action"
                      disabled={!isAvailable || isMaxInCart}
                      onClick={() => addToCart(item)}
                      style={{
                        background: !isAvailable ? 'rgba(255, 255, 255, 0.1)' : (isMaxInCart ? 'rgba(245, 158, 11, 0.2)' : 'var(--primary-gradient)'),
                        color: isMaxInCart ? '#fbbf24' : '#fff',
                        cursor: (isAvailable && !isMaxInCart) ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {!isAvailable ? 'Sold Out' : (isMaxInCart ? 'Max in Cart' : 'Add to Cart')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: Cart & Preferences */}
        <div>
          {/* Cart Card */}
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: hasStaleCartIssues ? '#f59e0b' : 'rgba(255, 94, 58, 0.3)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🛒 Shopping Cart</span>
              <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: '#fff', padding: '2px 10px', borderRadius: '20px' }}>
                {(cart || []).reduce((s, i) => s + (i.qty || 1), 0)} Items
              </span>
            </h3>

            {/* Stale Overload Warning Banner */}
            {hasStaleCartIssues && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '10px',
                  padding: '0.6rem 0.8rem',
                  color: '#fbbf24',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px'
                }}
              >
                <span>⚠️</span>
                <div>
                  Some items in your cart exceed available portions. Please reduce quantities to proceed.
                </div>
              </div>
            )}

            <div style={{ minHeight: '80px', maxHeight: '240px', overflowY: 'auto', marginBottom: '1rem' }}>
              {(!cart || cart.length === 0) ? (
                <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                  Your cart is empty. Add delicious items to get started!
                </p>
              ) : (
                cart.map((item) => {
                  const itemId = item.id || item._id;
                  const menuItem = menuItemsMap.get(itemId) || item;
                  const itemCheck = checkCartItemInventory(item, menuItem);
                  const availQty = menuItem.availableQuantity;
                  const isAvailable = menuItem.available !== false;
                  const isSoldOut = !isAvailable || (availQty !== null && availQty !== undefined && Number(availQty) <= 0);
                  const isAtMax = availQty !== null && availQty !== undefined && (item.qty || 1) >= Number(availQty);
                  const isPlusDisabled = isAtMax || isSoldOut;

                  return (
                    <div key={itemId} style={{ padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ maxWidth: '45%' }}>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>₹{item.price} each</div>
                        </div>

                        {/* Stepper Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              if (updateCartQty) {
                                updateCartQty(itemId, (item.qty || 1) - 1, availQty);
                              } else if (removeFromCart && (item.qty || 1) <= 1) {
                                removeFromCart(itemId);
                              }
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              borderRadius: '6px',
                              width: '22px',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontWeight: 800,
                              fontSize: '0.85rem'
                            }}
                          >
                            −
                          </button>

                          <span style={{ fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                            {item.qty || 1}
                          </span>

                          <button
                            disabled={isPlusDisabled}
                            onClick={() => {
                              if (updateCartQty) {
                                updateCartQty(itemId, (item.qty || 1) + 1, availQty);
                              }
                            }}
                            style={{
                              background: isPlusDisabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: isPlusDisabled ? 'rgba(255, 255, 255, 0.25)' : '#fff',
                              borderRadius: '6px',
                              width: '22px',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isPlusDisabled ? 'not-allowed' : 'pointer',
                              fontWeight: 800,
                              fontSize: '0.85rem'
                            }}
                          >
                            +
                          </button>

                          <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginLeft: '4px', minWidth: '40px', textAlign: 'right' }}>
                            ₹{item.price * (item.qty || 1)}
                          </span>

                          <button
                            onClick={() => removeFromCart && removeFromCart(itemId)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', marginLeft: '4px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Stale Overload Alert */}
                      {(itemCheck.isOverload || itemCheck.isSoldOut) && (
                        <div style={{ marginTop: '4px', color: itemCheck.isSoldOut ? '#f87171' : '#fbbf24', fontSize: '0.74rem' }}>
                          ⚠️ {itemCheck.warning}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--bg-card-border)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total Amount:</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>₹{cartTotal}</span>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginTop: '0.8rem', marginBottom: '0.8rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                Select Payment Method:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="RAZORPAY"
                    checked={paymentMethod === 'RAZORPAY'}
                    onChange={() => setPaymentMethod('RAZORPAY')}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  <span>💳 Online Payment (Razorpay)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  <span>💵 Cash on Delivery (COD)</span>
                </label>
              </div>
            </div>

            <button
              className="btn-action"
              disabled={!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut}
              onClick={handleCheckout}
              style={{
                background: (hasStaleCartIssues || isCheckingOut) ? '#64748b' : 'var(--primary-gradient)',
                cursor: (!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut) ? 'not-allowed' : 'pointer',
                opacity: isCheckingOut ? 0.75 : 1
              }}
            >
              {isCheckingOut
                ? (checkoutStatusMsg || 'Processing Order...')
                : (hasStaleCartIssues 
                    ? 'Adjust Quantities to Checkout' 
                    : (paymentMethod === 'COD' ? 'Confirm Order (Cash on Delivery)' : 'Proceed to Payment & Checkout'))}
            </button>
          </div>

          {/* Preferences Quick Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.8rem' }}>Your Preferences</h3>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {['Vegetarian', 'Paneer', 'Biryani', 'Spicy'].map((pref, i) => (
                <span key={i} style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 242, 254, 0.3)', padding: '4px 10px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 700 }}>
                  ✓ {pref}
                </span>
              ))}
            </div>
            <Link to="/customer/preferences" className="cat-btn" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', width: '100%' }}>
              Manage Preferences
            </Link>
          </div>

          {/* Customer Order History Card */}
          {customerOrders.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.8rem' }}>📦 Order History ({customerOrders.length})</h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {customerOrders.map((ord) => {
                  const statusInfo = ORDER_STATUS_MAP[ord.status] || { label: ord.status, badgeColor: '#64748b' };
                  const isDelivered = ord.status === 'DELIVERED';
                  const isFailed = ord.status === 'CANCELLED' || ord.status === 'REJECTED';

                  return (
                    <div key={ord.id} style={{
                      padding: '0.75rem 0',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#fff' }}>
                          Order #{ord.id ? ord.id.substring(0, 8) : '---'}
                        </span>
                        <span style={{
                          background: isFailed ? 'rgba(239, 68, 68, 0.15)' : (isDelivered ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                          color: statusInfo.badgeColor,
                          border: `1px solid ${statusInfo.badgeColor}`,
                          padding: '1px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-sub)' }}>
                        <div>
                          <span>Total: ₹{ord.totalAmount}</span>
                          <span style={{ margin: '0 4px' }}>•</span>
                          <span>{ord.items?.length || 0} items</span>
                        </div>
                        <button
                          onClick={() => setTrackingModalOrderId(ord.id)}
                          style={{
                            background: 'rgba(0, 242, 254, 0.1)',
                            border: '1px solid rgba(0, 242, 254, 0.25)',
                            color: 'var(--accent-cyan)',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Track / View →
                        </button>
                      </div>

                      {ord.createdAt && (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '3px' }}>
                          {formatOrderTimestamp(ord.createdAt)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Order Tracking Modal */}
      {trackingModalOrderId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '20px'
          }}>
            <OrderTrackingView
              orderId={trackingModalOrderId}
              onClose={() => setTrackingModalOrderId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

