import React from 'react';

export default function Features() {
  const items = [
    {
      title: 'Smart Food Delivery',
      desc: 'Efficient food ordering and delivery management through a distributed platform.',
      icon: '🍴',
      color: '#ff5e3a'
    },
    {
      title: 'Intelligent Recommendations',
      desc: 'Personalized food recommendations based on customer preferences and operational context.',
      icon: '🤖',
      color: '#3b82f6'
    },
    {
      title: 'Intelligent Delivery',
      desc: 'Smarter delivery assignment and ETA estimation using operational information.',
      icon: '🚴',
      color: '#f59e0b'
    },
    {
      title: 'Food Rescue',
      desc: 'Help reduce food waste by making eligible surplus food available through time-sensitive rescue offers.',
      icon: '♻️',
      color: '#10b981'
    },
    {
      title: 'Demand Forecasting',
      desc: 'Help restaurants anticipate demand and improve food preparation planning.',
      icon: '📊',
      color: '#a855f7'
    }
  ];

  return (
    <section id="features" style={{ padding: '4rem 0', fontFamily: 'var(--font-body)' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.25rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '0.75rem'
        }}>
          Intelligent Platform Capabilities
        </h2>
        <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          SmartEats coordinates five core modules to enhance food delivery efficiency and combat environmental waste.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem'
      }}>
        {items.map((feat) => (
          <div
            key={feat.title}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = feat.color;
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = `0 10px 30px rgba(0,0,0,0.05)`;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
            }}
          >
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: `${feat.color}10`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              marginBottom: '1.25rem'
            }}>
              {feat.icon}
            </div>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>
              {feat.title}
            </h3>
            <p style={{
              fontSize: '0.88rem',
              color: '#475569',
              lineHeight: '1.55'
            }}>
              {feat.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
