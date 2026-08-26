import React from 'react';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--bg-card-border)', background: 'rgba(11, 15, 25, 0.95)', padding: '2.5rem 2rem', marginTop: '4rem' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
        <div>
          <div className="brand" style={{ marginBottom: '0.8rem' }}>
            <div className="brand-icon">⚡</div>
            <div className="brand-text">Smart<span>Eats</span></div>
          </div>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', lineHeight: '1.6' }}>
            Intelligent Food Delivery. Smarter Decisions. Less Waste. Powered by Distributed Microservices, Apache Kafka, and RDSS AI Engine.
          </p>
        </div>

        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Ecosystem Roles</h4>
          <ul style={{ listStyle: 'none', color: 'var(--text-sub)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>🛍️ Customer Ordering Portal</li>
            <li>🏪 Restaurant RDSS Dashboard</li>
            <li>🛵 Delivery Partner Operations</li>
            <li>🤝 NGO Food Rescue Community</li>
            <li>🛡️ System Administrator Portal</li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Smart Technologies</h4>
          <ul style={{ listStyle: 'none', color: 'var(--text-sub)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>📈 Random Forest Demand Forecasting</li>
            <li>♻️ Dynamic Surplus Rescue Discounts</li>
            <li>⚡ Apache Kafka Event Streaming</li>
            <li>🛵 Proximity Matching & Smart ETA</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-sub)', fontSize: '0.8rem' }}>
        SmartEats MCA Capstone Dissertation Project © 2026. All rights reserved.
      </div>
    </footer>
  );
}
