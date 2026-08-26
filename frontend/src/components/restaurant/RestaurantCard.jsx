import React from 'react';

export default function RestaurantCard({ restaurant }) {
  const isOpen = restaurant.status?.toLowerCase() === 'open';

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-body)'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.06)';
      e.currentTarget.style.borderColor = '#cbd5e1';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
      e.currentTarget.style.borderColor = '#e2e8f0';
    }}
    >
      <div style={{ position: 'relative', height: '170px', overflow: 'hidden' }}>
        <img
          src={restaurant.image}
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
          {restaurant.status}
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.15rem',
            fontWeight: 800,
            color: '#0f172a'
          }}>
            {restaurant.name}
          </h3>
          <span style={{
            background: 'rgba(249, 115, 22, 0.08)',
            color: '#ea580c',
            padding: '2px 8px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            {restaurant.rating}
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.8rem' }}>
          {restaurant.cuisine}
        </div>

        <div style={{
          marginTop: 'auto',
          paddingTop: '0.8rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          color: '#475569',
          fontWeight: 600
        }}>
          <span>⏱️ {restaurant.deliveryTime}</span>
          <span style={{ color: '#64748b' }}>📍 {restaurant.location.split(',')[0]}</span>
        </div>
      </div>
    </div>
  );
}
