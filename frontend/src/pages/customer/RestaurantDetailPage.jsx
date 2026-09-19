import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { restaurantApi } from '../../api/restaurantApi';
import { orderApi } from '../../api/orderApi';
import { useAuth } from '../../context/AuthContext';
import { getCustomerAvailabilityStatus, checkCartItemInventory } from '../../utils/inventoryUtils';
import { initiateRazorpayCheckout } from '../../utils/razorpayUtils';

export default function RestaurantDetailPage({ cart = [], setCart, addToCart, updateCartQty, removeFromCart }) {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [addedItemIds, setAddedItemIds] = useState({});
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [checkoutStatusMsg, setCheckoutStatusMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY'); // 'RAZORPAY' | 'COD'

  useEffect(() => {
    let isMounted = true;

    const loadRestaurantAndMenu = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch restaurant details and menu items concurrently
        const [restRes, menuRes] = await Promise.allSettled([
          restaurantApi.getRestaurantById(restaurantId),
          restaurantApi.getMenu(restaurantId)
        ]);

        if (!isMounted) return;

        let restData = null;
        if (restRes.status === 'fulfilled' && restRes.value) {
          restData = restRes.value;
        } else {
          // Fallback: search within all restaurants
          const all = await restaurantApi.getRestaurants();
          restData = (all || []).find((r) => (r.id || r._id) === restaurantId);
        }

        if (!restData) {
          setError('Restaurant not found or currently unavailable.');
          setLoading(false);
          return;
        }

        setRestaurant(restData);

        if (menuRes.status === 'fulfilled' && menuRes.value) {
          const items = Array.isArray(menuRes.value) ? menuRes.value : (menuRes.value.data || []);
          setMenuItems(items);
        } else {
          setMenuItems([]);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading restaurant details:', err);
          setError('Failed to load restaurant details or menu. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (restaurantId) {
      loadRestaurantAndMenu();
    } else {
      setError('No restaurant ID provided in URL.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [restaurantId]);

  // Map of menu items for O(1) inventory check in cart
  const menuItemsMap = React.useMemo(() => {
    return new Map((menuItems || []).map((m) => [m.id || m._id, m]));
  }, [menuItems]);

  // Check if any cart item has a stale overload or is sold out
  const hasStaleCartIssues = React.useMemo(() => {
    if (!cart || cart.length === 0) return false;
    return cart.some((cartItem) => {
      const menuItem = menuItemsMap.get(cartItem.id || cartItem._id) || cartItem;
      const check = checkCartItemInventory(cartItem, menuItem);
      return check.isOverload || check.isSoldOut;
    });
  }, [cart, menuItemsMap]);

  // Extract distinct categories from menu items
  const categories = React.useMemo(() => {
    const cats = new Set();
    menuItems.forEach((item) => {
      if (item.category) {
        cats.add(item.category.trim());
      }
    });
    return Array.from(cats);
  }, [menuItems]);

  // Filtered menu items by search query and category
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' ||
      item.category?.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (item) => {
    const itemId = item.id || item._id;
    if (addToCart) {
      // Attach restaurant info for order context
      const added = addToCart({
        ...item,
        restaurantId: restaurantId,
        restaurantName: restaurant?.name || 'Restaurant'
      });

      if (added !== false) {
        // Temporary visual feedback
        setAddedItemIds((prev) => ({ ...prev, [itemId]: true }));
        setTimeout(() => {
          setAddedItemIds((prev) => ({ ...prev, [itemId]: false }));
        }, 1200);
      }
    }
  };

  const cartTotal = (cart || []).reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);

  const handleCheckout = async () => {
    if (!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues) return;

    // Generate cryptographically unique idempotency key for this checkout attempt
    const checkoutKey = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (paymentMethod === 'COD') {
      setOrderSubmitting(true);
      setCheckoutStatusMsg('Placing Cash on Delivery Order...');
      try {
        const orderResponse = await orderApi.placeCodOrder(checkoutKey);
        const newOrder = {
          id: orderResponse.id,
          status: orderResponse.status || 'CREATED',
          paymentStatus: orderResponse.paymentStatus || 'PENDING',
          paymentMethod: 'COD',
          totalAmount: orderResponse.totalAmount || cartTotal,
          items: cart,
          etaMinutes: 25,
          createdAt: orderResponse.createdAt || new Date().toISOString()
        };
        alert(`Order Placed Successfully! 🎉\n\nOrder ID: ${orderResponse.id}\nPayment Method: Cash on Delivery\nPayment Status: Pending\nStatus: Confirmed (CREATED)`);
        setActiveOrder(newOrder);
        if (typeof clearCart === 'function') {
          clearCart();
        } else if (setCart) {
          setCart([]);
        }
        fetchMenu();
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to place Cash on Delivery order.';
        alert(msg);
        fetchMenu();
      } finally {
        setOrderSubmitting(false);
        setCheckoutStatusMsg('');
      }
      return;
    }

    // Razorpay flow
    await initiateRazorpayCheckout({
      user,
      idempotencyKey: checkoutKey,
      onLoadingChange: (loading, msg) => {
        setOrderSubmitting(loading);
        setCheckoutStatusMsg(msg || '');
      },
      onSuccess: (paymentResult) => {
        const newOrder = {
          id: paymentResult.orderId,
          status: paymentResult.orderStatus || 'CREATED',
          paymentStatus: paymentResult.paymentStatus || 'PAID',
          paymentMethod: 'RAZORPAY',
          totalAmount: paymentResult.amount,
          items: cart,
          etaMinutes: 25,
          createdAt: new Date().toISOString()
        };
        alert(`Order Placed & Paid Successfully! 🎉\n\nOrder ID: ${paymentResult.orderId}\nPayment Status: PAID\nStatus: CREATED`);
        setActiveOrder(newOrder);
        if (typeof clearCart === 'function') {
          clearCart();
        } else if (setCart) {
          setCart([]);
        }
        fetchMenu();
      },
      onFailure: (errMsg) => {
        alert(errMsg);
        fetchMenu();
      },
      onDismiss: (dismissMsg) => {
        alert(dismissMsg);
      }
    });
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '0.5rem' }}>
          Loading Restaurant Menu...
        </h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
          Fetching fresh kitchen items and operating hours
        </p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem' }}>
        <button
          onClick={() => navigate('/customer/restaurants')}
          className="cat-btn"
          style={{ marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ← Back to All Restaurants
        </button>

        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '20px',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#f8fafc'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#f87171', marginBottom: '0.8rem' }}>
            {error || 'Restaurant Not Found'}
          </h2>
          <p style={{ color: 'var(--text-sub)', maxWidth: '500px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            We could not find the requested restaurant details. It may have been updated or removed.
          </p>
          <button
            onClick={() => navigate('/customer/restaurants')}
            className="btn-action"
            style={{ width: 'auto', padding: '0.75rem 2rem', display: 'inline-block' }}
          >
            Browse Restaurants Directory
          </button>
        </div>
      </div>
    );
  }

  const isOpen = restaurant.open !== undefined
    ? Boolean(restaurant.open)
    : (restaurant.status?.toLowerCase() === 'open');

  const displayImage =
    restaurant.logoUrl ||
    restaurant.image ||
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

  const cuisineText = restaurant.cuisineType || restaurant.cuisine || 'Multi-Cuisine';
  const locationText = restaurant.location || [restaurant.address, restaurant.city, restaurant.pincode].filter(Boolean).join(', ') || 'Bengaluru';
  const operatingHours = (restaurant.openingTime && restaurant.closingTime)
    ? `${restaurant.openingTime} - ${restaurant.closingTime}`
    : 'Hours not specified';

  return (
    <div className="container" style={{ marginTop: '1.5rem', marginBottom: '3rem' }}>
      {/* Top Back Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/customer/restaurants')}
          className="cat-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            padding: '0.6rem 1.2rem',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#fff'
          }}
        >
          ← Back to Restaurants
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
            Restaurant ID:
          </span>
          <code style={{
            background: 'rgba(0, 242, 254, 0.1)',
            color: 'var(--accent-cyan)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.8rem'
          }}>
            {restaurant.id || restaurant._id}
          </code>
        </div>
      </div>

      {/* Restaurant Header Hero Banner */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          marginBottom: '2rem',
          borderColor: isOpen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ position: 'relative', height: '220px', width: '100%', overflow: 'hidden' }}>
          <img
            src={displayImage}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(11, 15, 25, 0.95) 0%, rgba(11, 15, 25, 0.4) 60%, rgba(11, 15, 25, 0.1) 100%)'
            }}
          />

          {/* Open/Closed Badge Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: isOpen ? '#10b981' : '#64748b',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.85rem',
              padding: '6px 14px',
              borderRadius: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
            }}
          >
            {isOpen ? '● OPEN NOW' : '○ CLOSED'}
          </div>
        </div>

        {/* Restaurant Details Section */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: '#fff'
                  }}
                >
                  {restaurant.name}
                </h1>
                <span
                  style={{
                    background: 'rgba(249, 115, 22, 0.15)',
                    color: '#ea580c',
                    padding: '4px 12px',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 700
                  }}
                >
                  {restaurant.rating || '4.5 ★'}
                </span>
              </div>

              <div style={{ color: 'var(--accent-cyan)', fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>
                {cuisineText}
              </div>

              {restaurant.description && (
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '8px', maxWidth: '650px' }}>
                  {restaurant.description}
                </p>
              )}
            </div>

            {/* Quick Meta Info Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-sub)' }}>
                ⏰ <strong>Operating Hours:</strong> {operatingHours}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-sub)' }}>
                📍 <strong>Location:</strong> {locationText}
              </div>
              {restaurant.phone && (
                <div style={{ fontSize: '0.88rem', color: 'var(--text-sub)' }}>
                  📞 <strong>Phone:</strong> {restaurant.phone}
                </div>
              )}
            </div>
          </div>

          {/* Operating Hours Alert if Closed */}
          {!isOpen && (
            <div
              style={{
                marginTop: '1.2rem',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '0.85rem 1.2rem',
                color: '#fbbf24',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <strong>Kitchen is currently closed.</strong> Operating hours are <strong>{operatingHours}</strong>. You may still browse the menu and customize your cart.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Order Banner if just placed */}
      {activeOrder && (
        <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="badge badge-surplus" style={{ marginBottom: '0.4rem' }}>Order Placed!</span>
              <h3 style={{ fontFamily: 'var(--font-heading)' }}>Order #{activeOrder.id}</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '4px' }}>
                Status: {activeOrder.status || 'PREPARING'} • Estimated arrival: {activeOrder.etaMinutes || 25} mins
              </p>
            </div>
            <Link to="/customer/dashboard" className="btn-action" style={{ textDecoration: 'none', padding: '0.6rem 1.4rem', width: 'auto' }}>
              Track Live Delivery →
            </Link>
          </div>
        </div>
      )}

      {/* Main Section: Menu & Cart Layout */}
      <div className="grid-2">
        {/* Left Column: Menu Items */}
        <div>
          {/* Menu Search and Filters */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
                Menu Items ({filteredMenuItems.length})
              </h2>

              <div style={{ minWidth: '260px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search dishes in this menu..."
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--bg-card-border)',
                    color: '#fff',
                    padding: '0.6rem 1rem',
                    borderRadius: '12px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {/* Dynamic Category Filter Pills */}
            <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
              <button
                className={`cat-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('ALL')}
                style={{ padding: '0.5rem 1.2rem', whiteSpace: 'nowrap' }}
              >
                🍽️ All Items ({menuItems.length})
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`cat-btn ${selectedCategory.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ padding: '0.5rem 1.2rem', whiteSpace: 'nowrap' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items List / Grid */}
          {filteredMenuItems.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: 'var(--text-sub)',
                border: '1px dashed var(--bg-card-border)'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🍽️</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
                {menuItems.length === 0
                  ? 'No menu items listed yet for this restaurant.'
                  : 'No dishes match your search or filter.'}
              </h3>
              <p style={{ fontSize: '0.88rem' }}>
                {menuItems.length === 0
                  ? 'The restaurant owner has not added menu items yet. Check back soon!'
                  : 'Try changing your search term or switching categories.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                  }}
                  className="cat-btn"
                  style={{ marginTop: '1rem' }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
              {filteredMenuItems.map((item) => {
                const itemId = item.id || item._id;
                const status = getCustomerAvailabilityStatus(item);
                const isAvailable = status.isOrderable;
                const isAdded = Boolean(addedItemIds[itemId]);

                const currentCartItem = (cart || []).find((i) => (i.id || i._id) === itemId);
                const inCartQty = currentCartItem ? (currentCartItem.qty || 1) : 0;
                const isMaxInCart = item.availableQuantity !== null && item.availableQuantity !== undefined && inCartQty >= Number(item.availableQuantity);

                return (
                  <div
                    key={itemId}
                    className="card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '1.25rem',
                      opacity: isAvailable ? 1 : 0.65,
                      borderColor: isAdded ? 'var(--accent-green)' : (isMaxInCart ? 'rgba(245, 158, 11, 0.4)' : 'var(--bg-card-border)'),
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--accent-cyan)',
                          background: 'rgba(0, 242, 254, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {item.category || 'Specialty'}
                      </span>

                      {/* Customer-Friendly Availability Status Badge (No exact inventory count shown) */}
                      <span
                        style={{
                          fontSize: '0.75rem',
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

                    <h3
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '0.3rem'
                      }}
                    >
                      {item.name}
                    </h3>

                    {item.description && (
                      <p
                        style={{
                          color: 'var(--text-sub)',
                          fontSize: '0.82rem',
                          lineHeight: '1.4',
                          marginBottom: '0.8rem',
                          flexGrow: 1
                        }}
                      >
                        {item.description}
                      </p>
                    )}

                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '0.8rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: 'var(--accent-cyan)'
                        }}
                      >
                        ₹{item.price}
                      </div>

                      <button
                        className="btn-action"
                        disabled={!isAvailable || isMaxInCart}
                        onClick={() => handleAddToCart(item)}
                        style={{
                          width: 'auto',
                          marginTop: 0,
                          padding: '0.5rem 1.1rem',
                          fontSize: '0.85rem',
                          background: isAdded
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : (isAvailable
                                ? (isMaxInCart ? 'rgba(245, 158, 11, 0.2)' : 'var(--primary-gradient)')
                                : 'rgba(255, 255, 255, 0.1)'),
                          color: isMaxInCart ? '#fbbf24' : '#fff',
                          border: isMaxInCart ? '1px solid rgba(245, 158, 11, 0.4)' : 'none',
                          cursor: (isAvailable && !isMaxInCart) ? 'pointer' : 'not-allowed',
                          boxShadow: isAdded ? '0 4px 14px rgba(16, 185, 129, 0.4)' : undefined
                        }}
                      >
                        {isAdded
                          ? 'Added! ✓'
                          : (!isAvailable
                              ? 'Sold Out'
                              : (isMaxInCart ? 'Max in Cart' : '+ Add to Cart'))}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Cart Summary */}
        <div>
          <div
            className="card"
            style={{
              position: 'sticky',
              top: '90px',
              borderColor: hasStaleCartIssues ? '#f59e0b' : 'rgba(255, 94, 58, 0.3)'
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>🛒 Your Cart</span>
              <span
                style={{
                  fontSize: '0.8rem',
                  background: 'var(--primary)',
                  color: '#fff',
                  padding: '2px 10px',
                  borderRadius: '20px'
                }}
              >
                {(cart || []).reduce((s, i) => s + (i.qty || 1), 0)} Items
              </span>
            </h3>

            {/* Stale Cart Overload Warning Banner */}
            {hasStaleCartIssues && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.8rem',
                  color: '#fbbf24',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: '1.4'
                }}
              >
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <div>
                  <strong>Portion Limit Exceeded:</strong> Some items in your cart exceed currently available portion stock. Please reduce quantities to proceed with checkout.
                </div>
              </div>
            )}

            <div
              style={{
                minHeight: '80px',
                maxHeight: '280px',
                overflowY: 'auto',
                marginBottom: '1rem'
              }}
            >
              {(!cart || cart.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🛍️</div>
                  Your cart is empty.<br />Click "+ Add to Cart" on any dish to begin!
                </div>
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
                    <div
                      key={itemId}
                      style={{
                        padding: '0.7rem 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ maxWidth: '50%' }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{item.name}</div>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                            ₹{item.price} each
                          </div>
                        </div>

                        {/* Stepper Controls: [ - ] qty [ + ] */}
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
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontWeight: 800,
                              fontSize: '0.9rem'
                            }}
                            title="Decrease quantity"
                          >
                            −
                          </button>

                          <span style={{ fontWeight: 700, color: '#fff', minWidth: '20px', textAlign: 'center' }}>
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
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isPlusDisabled ? 'not-allowed' : 'pointer',
                              fontWeight: 800,
                              fontSize: '0.9rem'
                            }}
                            title={isPlusDisabled ? 'Max available quantity reached' : 'Increase quantity'}
                          >
                            +
                          </button>

                          <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginLeft: '6px', minWidth: '45px', textAlign: 'right' }}>
                            ₹{item.price * (item.qty || 1)}
                          </span>

                          <button
                            onClick={() => removeFromCart && removeFromCart(itemId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '0.85rem',
                              marginLeft: '4px'
                            }}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Stale Cart or Sold Out Alert for this specific item */}
                      {(itemCheck.isOverload || itemCheck.isSoldOut) && (
                        <div
                          style={{
                            marginTop: '6px',
                            background: itemCheck.isSoldOut ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                            border: itemCheck.isSoldOut ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: itemCheck.isSoldOut ? '#f87171' : '#fbbf24',
                            fontSize: '0.76rem',
                            lineHeight: '1.3'
                          }}
                        >
                          ⚠️ {itemCheck.warning}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                borderTop: '1px solid var(--bg-card-border)',
                paddingTop: '0.8rem',
                marginBottom: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700
              }}
            >
              <span>Total Amount:</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>₹{cartTotal}</span>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                Select Payment Method:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                  <input
                    type="radio"
                    name="restaurantPaymentMethod"
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
                    name="restaurantPaymentMethod"
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
              disabled={!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues}
              onClick={handleCheckout}
              style={{
                opacity: (!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues) ? 0.6 : 1,
                cursor: (!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues) ? 'not-allowed' : 'pointer',
                background: (hasStaleCartIssues || orderSubmitting) ? '#64748b' : 'var(--primary-gradient)'
              }}
            >
              {orderSubmitting
                ? (checkoutStatusMsg || 'Processing Order...')
                : (hasStaleCartIssues 
                    ? 'Please Adjust Quantities to Checkout' 
                    : (paymentMethod === 'COD' ? 'Confirm Order (Cash on Delivery)' : 'Proceed to Payment & Checkout'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
