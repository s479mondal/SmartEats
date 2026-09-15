import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { deliveryApi } from '../api/orderApi';

export default function DriverPortal() {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' or 'COMPLETED'

  const fetchDeliveries = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await deliveryApi.getMyDeliveries();
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not fetch rider deliveries:', err);
      setError('Failed to fetch assigned deliveries from Delivery Service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleToggleAvailability = async () => {
    const nextState = !isActive;
    setActionLoading(true);
    try {
      await deliveryApi.updatePartnerAvailability(nextState, nextState);
      setIsActive(nextState);
      setSuccessMsg(`Status updated to ${nextState ? 'ACTIVE' : 'OFFLINE'}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to update availability: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptDelivery = async (deliveryId) => {
    setActionLoading(true);
    try {
      await deliveryApi.acceptDelivery(deliveryId);
      setSuccessMsg('✅ Delivery accepted! Heading to restaurant pickup location.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDeliveries();
    } catch (err) {
      alert('Failed to accept delivery: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (deliveryId, nextStatus) => {
    setActionLoading(true);
    try {
      await deliveryApi.updateDeliveryStatus(deliveryId, nextStatus);
      setSuccessMsg(`✅ Delivery status updated to ${nextStatus.replace(/_/g, ' ')}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDeliveries();
    } catch (err) {
      alert('Failed to update delivery status: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const activeDeliveries = deliveries.filter((d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED');
  const completedDeliveries = deliveries.filter((d) => d.status === 'DELIVERED');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ background: '#f59e0b', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>PENDING ACCEPTANCE</span>;
      case 'ASSIGNED':
        return <span style={{ background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>ASSIGNED TO YOU</span>;
      case 'PICKED_UP':
        return <span style={{ background: '#a855f7', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>PICKED UP FROM RESTAURANT</span>;
      case 'OUT_FOR_DELIVERY':
        return <span style={{ background: '#00f2fe', color: '#000', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>OUT FOR DELIVERY</span>;
      case 'DELIVERED':
        return <span style={{ background: 'var(--accent-green)', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>DELIVERED</span>;
      default:
        return <span style={{ background: '#64748b', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge badge-ai" style={{ marginBottom: '0.4rem' }}>🛵 Rider Partner Console</span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>Delivery Assignments Portal</h1>
          <p style={{ color: 'var(--text-sub)' }}>
            Rider Account: <strong>{user?.name || 'Rider'}</strong> ({user?.email})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={fetchDeliveries}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Assignments'}
          </button>

          <button
            onClick={handleToggleAvailability}
            disabled={actionLoading}
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
            <span>Status: {isActive ? 'ONLINE & ACTIVE' : 'OFFLINE'}</span>
            <span style={{ width: '10px', height: '10px', background: isActive ? 'var(--accent-green)' : '#ef4444', borderRadius: '50%', display: 'inline-block' }}></span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--accent-green)', padding: '0.9rem 1.2rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('ACTIVE')}
          style={{ background: activeTab === 'ACTIVE' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'ACTIVE' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          📦 Active Deliveries ({activeDeliveries.length})
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          style={{ background: activeTab === 'COMPLETED' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'COMPLETED' ? '#000' : '#94a3b8', fontWeight: 700, padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          ✅ Delivery History ({completedDeliveries.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE DELIVERIES */}
      {activeTab === 'ACTIVE' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-sub)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              Fetching active delivery tasks from Delivery Service...
            </div>
          ) : activeDeliveries.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-sub)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>No Active Delivery Tasks</h3>
              <p style={{ marginTop: '0.4rem' }}>
                You have no pending or active delivery assignments at the moment. Keep your status <strong>ONLINE</strong> to receive nearby orders.
              </p>
            </div>
          ) : (
            <div className="grid-2">
              {activeDeliveries.map((delivery) => (
                <div key={delivery.id} className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                      <span className="badge badge-ai" style={{ margin: 0 }}>⚡ Real-Time Task</span>
                      {getStatusBadge(delivery.status)}
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>
                      Order #{delivery.orderId || 'N/A'}
                    </h3>

                    <div style={{ margin: '1rem 0', background: 'rgba(255,255,255,0.03)', padding: '0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 6px 0' }}>
                        📍 <strong>Restaurant ID:</strong> {delivery.restaurantId || 'N/A'}
                      </p>
                      <p style={{ margin: '0 0 6px 0' }}>
                        👤 <strong>Customer Email:</strong> {delivery.customerEmail || 'N/A'}
                      </p>
                      <p style={{ margin: '0 0 6px 0', color: 'var(--text-sub)' }}>
                        🧭 <strong>Pickup Coordinates:</strong> Lat {delivery.restaurantLatitude || 12.9716}, Lng {delivery.restaurantLongitude || 77.5946}
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-sub)' }}>
                        🏁 <strong>Dropoff Coordinates:</strong> Lat {delivery.deliveryLatitude || 12.9725}, Lng {delivery.deliveryLongitude || 77.5937}
                      </p>
                    </div>
                  </div>

                  {/* Actions State Machine */}
                  <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {delivery.status === 'PENDING' && (
                      <button
                        className="btn-action"
                        style={{ background: 'var(--accent-gradient)', color: '#000', fontWeight: 700 }}
                        disabled={actionLoading}
                        onClick={() => handleAcceptDelivery(delivery.id)}
                      >
                        Accept Delivery Assignment
                      </button>
                    )}

                    {delivery.status === 'ASSIGNED' && (
                      <button
                        className="btn-action"
                        style={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(delivery.id, 'PICKED_UP')}
                      >
                        Mark Picked Up from Kitchen 🍲
                      </button>
                    )}

                    {delivery.status === 'PICKED_UP' && (
                      <button
                        className="btn-action"
                        style={{ background: '#00f2fe', color: '#000', fontWeight: 700 }}
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
                      >
                        Start Trip: Out for Delivery 🛵
                      </button>
                    )}

                    {delivery.status === 'OUT_FOR_DELIVERY' && (
                      <button
                        className="btn-action"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', fontWeight: 700 }}
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(delivery.id, 'DELIVERED')}
                      >
                        Mark Delivered & Complete Order ✅
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPLETED DELIVERIES */}
      {activeTab === 'COMPLETED' && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Delivery History & Fulfilled Orders</h3>
          {completedDeliveries.length === 0 ? (
            <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>
              No completed deliveries on record yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                  <th style={{ padding: '0.8rem' }}>Order ID</th>
                  <th style={{ padding: '0.8rem' }}>Restaurant</th>
                  <th style={{ padding: '0.8rem' }}>Customer Email</th>
                  <th style={{ padding: '0.8rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedDeliveries.map((delivery) => (
                  <tr key={delivery.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.8rem', fontWeight: 700, color: '#fff' }}>#{delivery.orderId}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{delivery.restaurantId}</td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{delivery.customerEmail}</td>
                    <td style={{ padding: '0.8rem' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.75rem' }}>
                        DELIVERED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
