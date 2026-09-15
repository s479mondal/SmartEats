import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rescueApi, orderApi } from '../api/orderApi';
import { restaurantApi } from '../api/restaurantApi';

export default function CustomerPortal({ cart, setCart, addToCart, removeFromCart }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [menuItems, setMenuItems] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [rescueOffers, setRescueOffers] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch menu, restaurants, rescue offers, and customer orders
    Promise.all([
      restaurantApi.getMenu('all').catch(() => []),
      restaurantApi.getRestaurants().catch(() => []),
      rescueApi.getRescueOffers().catch(() => []),
      orderApi.getCustomerOrders().catch(() => [])
    ]).then(([menuRes, restRes, rescueRes, ordersRes]) => {
      setMenuItems(menuRes?.data || menuRes || []);
      setRestaurants(restRes?.data || restRes || []);
      setRescueOffers(rescueRes?.data || rescueRes || []);
      const fetchedOrders = ordersRes?.data || ordersRes || [];
      setCustomerOrders(Array.isArray(fetchedOrders) ? fetchedOrders : []);
      if (Array.isArray(fetchedOrders) && fetchedOrders.length > 0) {
        const active = fetchedOrders.find(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
        if (active) setActiveOrder(active);
      }
    }).finally(() => setLoading(false));
  }, []);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || 
                            (activeCategory === 'SURPLUS' && item.isSurplus) ||
                            item.category?.toUpperCase() === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cart.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const orderRes = await orderApi.createOrder({
        customerEmail: user?.email || 'customer@smarteats.com',
        items: cart,
        totalAmount: cartTotal
      });
      const newOrder = orderRes.data || orderRes || { id: 'ORD-1024', status: 'PREPARING', etaMinutes: 28 };
      alert(`Order Placed Successfully! ✅\n\nOrder ID: ${newOrder.id || 'ORD-1024'}`);
      setActiveOrder(newOrder);
      setCustomerOrders(prev => [newOrder, ...prev]);
      if (setCart) setCart([]);
    } catch (err) {
      alert('Checkout error: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      {/* Customer Personal Greeting */}
      <div className="hero-banner" style={{ padding: '2.5rem 2rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="hero-title">Hello, {user?.name || 'Customer'} 👋</h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', marginTop: '0.4rem' }}>What are you craving today?</p>
          <div style={{ marginTop: '1.2rem', maxWidth: '500px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search food or restaurant..."
              style={{ width: '100%', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--bg-card-border)', color: '#fff', padding: '0.8rem 1.2rem', borderRadius: '12px', fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>
        <div style={{ fontSize: '5rem' }}>🍛</div>
      </div>

      {/* Recommended For You Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Recommended For You</h2>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {[
            { title: '🍛 Paneer Biryani', cat: 'MAIN_COURSE' },
            { title: '🍕 Pizza', cat: 'PIZZA' },
            { title: '🥗 Healthy Meals', cat: 'HEALTHY' },
            { title: '🍔 Gourmet Burgers', cat: 'BURGER' }
          ].map((rec, i) => (
            <button
              key={i}
              className="cat-btn"
              style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', flexShrink: 0 }}
              onClick={() => setActiveCategory(rec.cat)}
            >
              {rec.title}
            </button>
          ))}
        </div>
      </div>

      {/* Active Order Banner */}
      {activeOrder && (
        <div className="card" style={{ marginBottom: '2.5rem', borderColor: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="badge badge-ai" style={{ marginBottom: '0.4rem' }}>Active Order</span>
              <h3 style={{ fontFamily: 'var(--font-heading)' }}>Order #{activeOrder.id || '1024'}</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '4px' }}>Status: {activeOrder.status || 'PREPARING'}... • Estimated arrival: {activeOrder.etaMinutes || 28} mins</p>
            </div>
            <Link to="/customer/dashboard" className="btn-action" style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', width: 'auto' }}>
              Track Order
            </Link>
          </div>
        </div>
      )}

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
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Nearby Restaurants & Dishes</h2>
          {loading ? (
            <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '2rem 0' }}>Loading fresh dishes...</div>
          ) : (
            <div className="grid-3">
              {filteredItems.map(item => (
                <div key={item.id || item._id} className="card">
                  {item.img && <img src={item.img} className="food-img" alt={item.name} />}
                  <div className="food-header">
                    <div className="food-title">{item.name}</div>
                    <div className="price-tag">₹{item.price}</div>
                  </div>
                  <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>{item.description || item.desc}</p>
                  <button className="btn-action" onClick={() => addToCart(item)}>Add to Cart</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Cart & Preferences */}
        <div>
          {/* Cart Card */}
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(255, 94, 58, 0.3)' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🛒 Shopping Cart</span>
              <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: '#fff', padding: '2px 10px', borderRadius: '20px' }}>
                {cart.reduce((s, i) => s + (i.qty || 1), 0)} Items
              </span>
            </h3>

            <div style={{ minHeight: '80px', maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
              {cart.length === 0 ? (
                <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>Your cart is empty. Add delicious items to get started!</p>
              ) : (
                cart.map(item => (
                  <div key={item.id || item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ color: 'var(--text-sub)' }}>₹{item.price} x {item.qty || 1}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>₹{item.price * (item.qty || 1)}</span>
                      <button onClick={() => removeFromCart(item.id || item._id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--bg-card-border)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total Amount:</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>₹{cartTotal}</span>
            </div>

            <button className="btn-action" disabled={cart.length === 0} onClick={handleCheckout}>
              Proceed to Payment & Checkout
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
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {customerOrders.map((ord) => (
                  <div key={ord.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Order #{ord.id?.substring(0, 8)}</span>
                      <span style={{ color: ord.status === 'DELIVERED' ? 'var(--accent-green)' : '#f59e0b' }}>{ord.status}</span>
                    </div>
                    <div style={{ color: 'var(--text-sub)', marginTop: '2px' }}>
                      Total: ₹{ord.totalAmount} • {ord.items?.length || 0} items
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
