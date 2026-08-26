import React, { useState } from 'react';

export default function NgoDashboard() {
  const [rescues, setRescues] = useState([
    { id: 'resc-ngo-1', restaurant: 'Spice Garden', foodItem: 'Paneer Biryani (12 Meals)', location: 'Indiranagar 100ft Rd', status: 'READY_FOR_PICKUP', timeRemaining: '45 mins' },
    { id: 'resc-ngo-2', restaurant: 'Artisan Pizza Hub', foodItem: 'Margherita Slices (8 Portions)', location: 'MG Road Metro', status: 'READY_FOR_PICKUP', timeRemaining: '30 mins' }
  ]);

  const handleAccept = (id) => {
    setRescues((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'ACCEPTED_BY_NGO' } : r)));
    alert('Rescue request accepted! Dispatch vehicle details shared with restaurant.');
  };

  const handleComplete = (id) => {
    setRescues((prev) => prev.filter((r) => r.id !== id));
    alert('Rescue pickup complete! Food saved stats updated.');
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="badge badge-ai" style={{ marginBottom: '0.5rem' }}>🤝 NGO Community Partner Portal</span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>Food Rescue Dispatch Dashboard</h1>
          <p style={{ color: 'var(--text-sub)' }}>Coordinate surplus food collection from local restaurants for community relief.</p>
        </div>
      </div>

      {/* Impact Stats */}
      <div className="metric-grid">
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Total Meals Rescued</div>
          <div className="metric-val" style={{ color: 'var(--accent-cyan)' }}>1,480 Meals</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Active Restaurant Partners</div>
          <div className="metric-val" style={{ color: 'var(--accent-green)' }}>14 Kitchens</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Food Waste Diverted</div>
          <div className="metric-val" style={{ color: '#a855f7' }}>666 kg</div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Available Surplus Pickups</h2>
      <div className="grid-2">
        {rescues.map((item) => (
          <div key={item.id} className="card" style={{ borderColor: 'rgba(168, 85, 247, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span className="badge badge-ai" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}>
                {item.status.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>⏳ {item.timeRemaining}</span>
            </div>

            <h3 style={{ fontFamily: 'var(--font-heading)' }}>{item.foodItem}</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>
              📍 <strong>{item.restaurant}</strong><br />
              {item.location}
            </p>

            {item.status === 'READY_FOR_PICKUP' ? (
              <button
                className="btn-action"
                style={{ background: '#a855f7' }}
                onClick={() => handleAccept(item.id)}
              >
                Accept & Reserve Rescue Pickup
              </button>
            ) : (
              <button
                className="btn-action"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                onClick={() => handleComplete(item.id)}
              >
                Mark Food Collected & Distributed
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
