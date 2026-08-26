import React, { useState } from 'react';

export default function DriverPortal() {
  const [isActive, setIsActive] = useState(true);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>Rider Delivery Portal</h1>
          <p style={{ color: 'var(--text-sub)' }}>Intelligent proximity matching & real-time route updates.</p>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            padding: '8px 16px',
            borderRadius: '30px',
            color: isActive ? 'var(--accent-green)' : '#ef4444',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          <span>Status: {isActive ? 'ACTIVE' : 'OFFLINE'}</span>
          <span style={{ width: '10px', height: '10px', background: isActive ? 'var(--accent-green)' : '#ef4444', borderRadius: '50%', display: 'inline-block' }}></span>
        </button>
      </div>

      <div className="grid-3">
        <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.4)' }}>
          <span className="badge badge-ai" style={{ marginBottom: '0.8rem' }}>⚡ AI Optimized Assignment</span>
          <h3 style={{ fontFamily: 'var(--font-heading)' }}>Order #ORD-9842</h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>
            Pickup: Artisan Pizza Hub (1.2 km)<br />
            Dropoff: 42 Palm Grove Ave (2.4 km)
          </p>
          <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '1.1rem', marginBottom: '1rem' }}>
            Payout: ₹85 + ₹20 Tip
          </div>
          <button
            className="btn-action"
            style={{ background: 'var(--accent-gradient)', color: '#000' }}
            onClick={() => alert('Delivery Accepted! Navigation started.')}
          >
            Accept Delivery
          </button>
        </div>
      </div>
    </div>
  );
}
