import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import OrderTrackingView from '../../components/customer/OrderTrackingView';

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/customer/dashboard')}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ← Back to Dashboard
        </button>
        <span style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>/</span>
        <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600 }}>
          Order #{orderId?.substring(0, 8)} Tracking
        </span>
      </div>

      <OrderTrackingView orderId={orderId} />
    </div>
  );
}
