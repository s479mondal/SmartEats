import React from 'react';

export default function RescueCard({ offer, onViewOffer }) {
  return (
    <div style={{
      background: 'white',
      border: '2px solid rgba(16, 185, 129, 0.25)',
      borderRadius: '20px',
      padding: '1.5rem',
      boxShadow: '0 4px 20px rgba(16, 185, 129, 0.03)',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: 'var(--font-body)'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.08)';
      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.03)';
      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)';
    }}
    >
      {/* Discount Badge */}
      <div style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: '#10b981',
        color: 'white',
        fontWeight: 800,
        fontSize: '0.8rem',
        padding: '5px 12px',
        borderRadius: '30px',
        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
      }}>
        {offer.discountPct}% OFF
      </div>

      <div style={{ marginBottom: '1.25rem', paddingRight: '4.5rem' }}>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.2rem',
          fontWeight: 800,
          color: '#0f172a',
          lineHeight: '1.25'
        }}>
          {offer.name}
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
          🏪 {offer.restaurant}
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        margin: '0.5rem 0 1rem 0'
      }}>
        <span style={{
          textDecoration: 'line-through',
          color: '#94a3b8',
          fontSize: '0.9rem'
        }}>
          Original: ₹{offer.originalPrice}
        </span>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: '1.5rem',
          color: '#10b981'
        }}>
          Rescue: ₹{offer.rescuePrice}
        </span>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '0.8rem',
        borderTop: '1px solid #f1f5f9',
        marginTop: 'auto'
      }}>
        <span style={{
          fontSize: '0.8rem',
          color: '#ea580c',
          fontWeight: 700,
          background: 'rgba(234, 88, 12, 0.08)',
          padding: '4px 10px',
          borderRadius: '8px'
        }}>
          ⏳ Expires in {offer.expiresInMins}m
        </span>

        <button
          onClick={() => onViewOffer(offer)}
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: 'none',
            color: '#059669',
            padding: '0.5rem 1rem',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.target.style.background = '#10b981'; e.target.style.color = 'white'; }}
          onMouseOut={(e) => { e.target.style.background = 'rgba(16, 185, 129, 0.1)'; e.target.style.color = '#059669'; }}
        >
          View Offer
        </button>
      </div>
    </div>
  );
}
