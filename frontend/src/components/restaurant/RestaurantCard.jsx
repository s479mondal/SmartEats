import React from 'react';

export default function RestaurantCard({ restaurant, dark = false }) {
  const isOpen = restaurant.open !== undefined 
    ? Boolean(restaurant.open) 
    : (restaurant.status?.toLowerCase() === 'open');

  const ratingText = restaurant.rating || '4.5 ★';
  const cuisineText = restaurant.cuisineType || restaurant.cuisine || 'Multi-Cuisine';
  const displayImage = restaurant.logoUrl || restaurant.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
  const locationText = restaurant.location 
    ? restaurant.location.split(',')[0] 
    : (restaurant.city || restaurant.address || 'Bengaluru');

  const isDarkMode = dark;

  return (
    <div
      style={{
        background: isDarkMode ? 'var(--bg-card, rgba(22, 31, 49, 0.7))' : 'white',
        border: isDarkMode ? '1px solid var(--bg-card-border, rgba(255, 255, 255, 0.08))' : '1px solid #e2e8f0',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.25)' : '0 4px 20px rgba(0,0,0,0.02)',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body)',
        color: isDarkMode ? 'var(--text-main, #f8fafc)' : '#0f172a'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = isDarkMode ? '0 16px 36px rgba(0,0,0,0.4)' : '0 12px 30px rgba(0,0,0,0.06)';
        e.currentTarget.style.borderColor = isDarkMode ? 'rgba(0, 242, 254, 0.4)' : '#cbd5e1';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isDarkMode ? '0 8px 24px rgba(0,0,0,0.25)' : '0 4px 20px rgba(0,0,0,0.02)';
        e.currentTarget.style.borderColor = isDarkMode ? 'var(--bg-card-border, rgba(255, 255, 255, 0.08))' : '#e2e8f0';
      }}
    >
      <div style={{ position: 'relative', height: '170px', overflow: 'hidden' }}>
        <img
          src={displayImage}
          alt={restaurant.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: isOpen ? '#10b981' : '#64748b',
          color: 'white',
          fontWeight: 700,
          fontSize: '0.75rem',
          padding: '4px 10px',
          borderRadius: '20px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {isOpen ? 'OPEN' : 'CLOSED'}
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '8px' }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.15rem',
            fontWeight: 800,
            color: isDarkMode ? '#fff' : '#0f172a'
          }}>
            {restaurant.name}
          </h3>
          <span style={{
            background: isDarkMode ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.08)',
            color: '#ea580c',
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            {ratingText}
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: isDarkMode ? 'var(--text-sub, #94a3b8)' : '#64748b', marginBottom: '0.8rem' }}>
          {cuisineText}
        </div>

        <div style={{
          marginTop: 'auto',
          paddingTop: '0.8rem',
          borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          color: isDarkMode ? 'var(--text-sub, #94a3b8)' : '#475569',
          fontWeight: 600
        }}>
          <span>⏱️ {restaurant.deliveryTime || '20-30 min'}</span>
          {restaurant.distanceKm != null ? (
            <span style={{ color: isDarkMode ? 'var(--accent-cyan, #00f2fe)' : '#059669', fontWeight: 700 }}>
              📍 {Number(restaurant.distanceKm).toFixed(2)} km away
            </span>
          ) : (
            <span style={{ color: isDarkMode ? 'var(--text-sub, #94a3b8)' : '#64748b' }}>
              📍 {locationText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

