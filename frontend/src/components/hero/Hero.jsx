import React from 'react';

export default function Hero({ onExploreRestaurants, onExploreRescue }) {
  const handleScroll = (selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" style={{
      padding: '5rem 2rem',
      background: 'radial-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(249, 115, 22, 0.02) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '3rem',
      flexWrap: 'wrap',
      borderRadius: '30px',
      margin: '2rem 0',
      border: '1px solid #f1f5f9',
      fontFamily: 'var(--font-body)'
    }}>
      <div style={{ flex: '1 1 500px', maxWidth: '650px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: '#059669',
          padding: '6px 16px',
          borderRadius: '30px',
          fontSize: '0.8rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: '1.5rem',
          letterSpacing: '0.5px'
        }}>
          ☘️ Sustainable Food Ecosystem
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '3.25rem',
          fontWeight: 800,
          color: '#0f172a',
          lineHeight: '1.15',
          letterSpacing: '-1.5px',
          marginBottom: '1.25rem'
        }}>
          Intelligent Food Delivery. <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Less Waste.</span>
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: '#475569',
          lineHeight: '1.65',
          marginBottom: '2.5rem'
        }}>
          SmartEats connects customers, restaurants and delivery partners through an intelligent food delivery ecosystem designed to improve delivery efficiency and reduce food waste.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleScroll('#restaurants')}
            style={{
              background: 'linear-gradient(135deg, #ff5e3a 0%, #f97316 100%)',
              color: 'white',
              border: 'none',
              padding: '0.95rem 2.2rem',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(249, 115, 22, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 22px rgba(249, 115, 22, 0.35)'; }}
            onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 18px rgba(249, 115, 22, 0.25)'; }}
          >
            Explore Restaurants
          </button>
          <button
            onClick={() => handleScroll('#rescue')}
            style={{
              background: 'white',
              color: '#059669',
              border: '2px solid #10b981',
              padding: '0.85rem 2.1rem',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.target.style.background = 'rgba(16, 185, 129, 0.05)'; e.target.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.transform = 'translateY(0)'; }}
          >
            Explore Food Rescue
          </button>
        </div>
      </div>

      <div style={{
        flex: '1 1 400px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Decorative graphic/image mock */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          height: '380px',
          background: 'white',
          borderRadius: '30px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
          border: '1px solid #f1f5f9',
          padding: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Top part representing map & algorithm */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '4px 10px', borderRadius: '10px', fontWeight: 600, color: '#475569' }}>📍 Haversine Proximity assignment</span>
            <span style={{ fontSize: '1.2rem' }}>🤖</span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            margin: '2rem 0'
          }}>
            {/* Mock timeline representing route & delivery optimization */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5e3a' }}></div>
              <div style={{ flex: 1, height: '2px', background: '#cbd5e1', borderStyle: 'dashed' }}></div>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justify: 'center', color: 'white', fontSize: '0.6rem' }}>✓</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              <span>Kitchen Prep</span>
              <span>Rider En Route</span>
              <span>Zero-Waste Dispatch</span>
            </div>
          </div>

          {/* Bottom Card representation of food rescue */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '16px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ fontSize: '2rem' }}>🥗</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Surplus Rescue Alert</div>
              <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>Veg Combo • 45% OFF • Expires soon</div>
            </div>
          </div>

          {/* Floating badge */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '-10px',
            transform: 'rotate(12deg)',
            background: '#ff5e3a',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.75rem',
            padding: '6px 14px',
            borderRadius: '10px',
            boxShadow: '0 4px 10px rgba(255, 94, 58, 0.3)'
          }}>
            RDSS AI Active
          </div>
        </div>
      </div>
    </section>
  );
}
