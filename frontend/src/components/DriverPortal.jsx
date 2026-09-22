import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { deliveryApi } from '../api/orderApi';
import { cleanTelUri, formatIndianPhone } from '../utils/phoneUtils';

export default function DriverPortal() {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [offers, setOffers] = useState([]);
  const [nowTime, setNowTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' or 'COMPLETED'

  // Step 8.3B: GPS Live Beacon State
  const [gpsStatus, setGpsStatus] = useState('IDLE'); // 'IDLE' | 'REQUESTING' | 'LIVE' | 'DENIED' | 'UNAVAILABLE' | 'ERROR'
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');
  const [lastLocationTime, setLastLocationTime] = useState(null);
  const [secondsSinceLastUpdate, setSecondsSinceLastUpdate] = useState(null);

  const watchIdRef = useRef(null);
  const lastBeaconTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  const fetchDeliveries = async () => {
    setError('');
    try {
      const data = await deliveryApi.getMyDeliveries();
      if (isMountedRef.current) {
        setDeliveries(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not fetch rider deliveries:', err);
      if (isMountedRef.current) {
        setError('Failed to fetch assigned deliveries from Delivery Service.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchOffers = async () => {
    if (!isActive) {
      setOffers([]);
      return;
    }
    try {
      const data = await deliveryApi.getOffers();
      if (isMountedRef.current) {
        setOffers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.debug('Could not fetch driver offers:', err);
    }
  };

  // 1-second timer ticker for countdowns and location elapsed time
  useEffect(() => {
    const ticker = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  // Step 8.3B: Real-time Geolocation Watcher Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);
    fetchDeliveries();
    fetchOffers();

    // Regular polling for offers and deliveries while online
    const pollInterval = setInterval(() => {
      if (isMountedRef.current && isActive) {
        fetchOffers();
        fetchDeliveries();
      }
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(pollInterval);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive]);

  // Timer ticker for seconds since last location update
  useEffect(() => {
    if (!lastLocationTime || !isActive) {
      setSecondsSinceLastUpdate(null);
      return;
    }

    const interval = setInterval(() => {
      if (lastLocationTime) {
        const diff = Math.floor((Date.now() - lastLocationTime.getTime()) / 1000);
        setSecondsSinceLastUpdate(diff >= 0 ? diff : 0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastLocationTime, isActive]);

  // Manage GPS Watcher based on isActive state
  useEffect(() => {
    if (!isActive) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('IDLE');
      setGpsErrorMsg('');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('UNAVAILABLE');
      setGpsErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setGpsStatus('REQUESTING');
    setGpsErrorMsg('');

    const sendBeacon = async (latitude, longitude, accuracy) => {
      try {
        await deliveryApi.updatePartnerLocation({
          latitude,
          longitude,
          accuracy: accuracy != null && accuracy >= 0 ? accuracy : null
        });
        if (isMountedRef.current) {
          const now = new Date();
          setLastLocationTime(now);
          setSecondsSinceLastUpdate(0);
          setGpsStatus('LIVE');
          setGpsErrorMsg('');
        }
      } catch (err) {
        console.warn('GPS backend beacon update failed:', err);
        if (isMountedRef.current) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            setGpsStatus('ERROR');
            setGpsErrorMsg('Authentication error updating location.');
          }
        }
      }
    };

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const { latitude, longitude, accuracy } = pos.coords;

        const now = Date.now();
        const timeSinceLast = now - lastBeaconTimeRef.current;
        const MIN_BEACON_INTERVAL_MS = 5000;

        if (timeSinceLast >= MIN_BEACON_INTERVAL_MS || lastBeaconTimeRef.current === 0) {
          lastBeaconTimeRef.current = now;
          sendBeacon(latitude, longitude, accuracy);
        } else {
          setGpsStatus('LIVE');
        }
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.warn('Geolocation error:', err);
        if (err.code === 1) {
          setGpsStatus('DENIED');
          setGpsErrorMsg('Location permission is required while online to provide your live delivery location.');
        } else if (err.code === 2) {
          setGpsStatus('UNAVAILABLE');
          setGpsErrorMsg('GPS position unavailable.');
        } else if (err.code === 3) {
          setGpsStatus('UNAVAILABLE');
          setGpsErrorMsg('GPS location request timed out.');
        } else {
          setGpsStatus('ERROR');
          setGpsErrorMsg('Unable to retrieve GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive]);

  const handleToggleAvailability = async () => {
    const nextState = !isActive;
    setActionLoading(true);
    try {
      await deliveryApi.updatePartnerAvailability(nextState, nextState);
      setIsActive(nextState);
      setSuccessMsg(`Status updated to ${nextState ? 'ONLINE & ACTIVE' : 'OFFLINE'}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      if (nextState) {
        fetchOffers();
        fetchDeliveries();
      } else {
        setOffers([]);
      }
    } catch (err) {
      alert('Failed to update availability: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    setActionLoading(true);
    try {
      await deliveryApi.acceptOffer(offerId);
      setSuccessMsg('✅ Offer accepted! Delivery assigned to you. Proceeding to restaurant pickup.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOffers();
      fetchDeliveries();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 409 || msg.toLowerCase().includes('already assigned')) {
        alert('⚡ Order already assigned to another driver who accepted first.');
      } else {
        alert('Failed to accept offer: ' + msg);
      }
      fetchOffers();
      fetchDeliveries();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId) => {
    setActionLoading(true);
    try {
      await deliveryApi.rejectOffer(offerId);
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
      setSuccessMsg('Delivery offer rejected.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.warn('Failed to reject offer:', err);
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* GPS Status Indicator */}
          {isActive && gpsStatus === 'LIVE' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-green)', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', boxShadow: '0 0 8px var(--accent-green)' }}></span>
              <span>📍 GPS LIVE {secondsSinceLastUpdate !== null ? `(Updated ${secondsSinceLastUpdate}s ago)` : ''}</span>
            </div>
          )}

          {isActive && gpsStatus === 'REQUESTING' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 600 }}>
              <span>📡 Acquiring GPS...</span>
            </div>
          )}

          {isActive && (gpsStatus === 'DENIED' || gpsStatus === 'UNAVAILABLE' || gpsStatus === 'ERROR') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 600 }}>
              <span>⚠️ GPS Unavailable</span>
            </div>
          )}

          {!isActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 500 }}>
              <span>⚪ GPS Tracking Stopped</span>
            </div>
          )}

          <button
            onClick={() => {
              fetchDeliveries();
              fetchOffers();
            }}
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

      {/* GPS Warning Banner */}
      {isActive && gpsErrorMsg && (
        <div style={{ background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.4)', color: '#fb923c', padding: '0.9rem 1.2rem', borderRadius: '12px', marginBottom: '1.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
          ⚠️ {gpsErrorMsg}
        </div>
      )}

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

      {/* Controlled Broadcast Incoming Delivery Offers */}
      {isActive && offers.length > 0 && (
        <div style={{ marginBottom: '2.5rem', background: 'rgba(0, 242, 254, 0.03)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>⚡</span>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: '#00f2fe', margin: 0 }}>
                Incoming Delivery Offers ({offers.length})
              </h2>
              <span className="badge badge-ai" style={{ margin: 0, background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
                Controlled Broadcast
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              ⚡ First driver to accept wins assignment atomically
            </span>
          </div>

          <div className="grid-2">
            {offers.map((offer) => {
              const expiresAtMs = offer.expiresAt ? new Date(offer.expiresAt).getTime() : 0;
              const secondsLeft = Math.max(0, Math.floor((expiresAtMs - nowTime) / 1000));
              const isUrgent = secondsLeft <= 15;
              const isExpired = secondsLeft <= 0;

              return (
                <div
                  key={offer.id}
                  className="card"
                  style={{
                    borderColor: isUrgent ? '#ef4444' : '#00f2fe',
                    background: isUrgent ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    boxShadow: isUrgent ? '0 0 15px rgba(239, 68, 68, 0.2)' : '0 0 15px rgba(0, 242, 254, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <span style={{ fontWeight: 800, color: '#00f2fe', fontSize: '0.8rem' }}>
                        📡 DELIVERY OFFER
                      </span>
                      <span
                        style={{
                          background: isExpired ? '#ef4444' : isUrgent ? '#f59e0b' : '#3b82f6',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {isExpired ? '⌛ EXPIRED' : `⏳ Expires in ${secondsLeft}s`}
                      </span>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '0.4rem' }}>
                      Order #{offer.orderId || 'N/A'}
                    </h3>

                    <div style={{ margin: '0.8rem 0', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 6px 0' }}>
                        📍 <strong>Restaurant:</strong> {offer.restaurantName || 'Restaurant'}
                      </p>
                      {offer.restaurantAddress && (
                        <p style={{ margin: '0 0 6px 0', color: 'var(--text-sub)' }}>
                          🏠 {offer.restaurantAddress}
                        </p>
                      )}
                      <p style={{ margin: '0 0 6px 0', color: '#10b981', fontWeight: 700 }}>
                        🛵 <strong>Distance to Pickup:</strong> {offer.distanceKm != null ? `${offer.distanceKm} km away` : 'Nearby'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                      className="btn-action"
                      style={{
                        background: isExpired ? '#64748b' : 'var(--accent-gradient)',
                        color: '#000',
                        fontWeight: 700,
                        flex: 2,
                        cursor: isExpired ? 'not-allowed' : 'pointer'
                      }}
                      disabled={actionLoading || isExpired}
                      onClick={() => handleAcceptOffer(offer.id)}
                    >
                      {actionLoading ? 'Accepting...' : isExpired ? 'Offer Expired' : '✅ Accept Offer'}
                    </button>
                    <button
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontWeight: 700,
                        padding: '0.6rem 1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        flex: 1
                      }}
                      disabled={actionLoading}
                      onClick={() => handleRejectOffer(offer.id)}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
                You have no active delivery assignments at the moment. Keep your status <strong>ONLINE</strong> to receive nearby order offers.
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <p style={{ margin: 0 }}>
                          📍 <strong>Restaurant:</strong> {delivery.restaurantName || delivery.restaurantId || 'N/A'}
                        </p>
                        {cleanTelUri(delivery.restaurantPhone) ? (
                          <a
                            href={cleanTelUri(delivery.restaurantPhone)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              color: '#22c55e',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              cursor: 'pointer'
                            }}
                            title={`Call ${delivery.restaurantName || 'Restaurant'} at ${formatIndianPhone(delivery.restaurantPhone)}`}
                          >
                            📞 Call Restaurant
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                            {delivery.restaurantPhone ? formatIndianPhone(delivery.restaurantPhone) : 'Restaurant phone not available'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 6px 0' }}>
                        👤 <strong>Customer Email:</strong> {delivery.customerEmail || 'N/A'}
                      </p>
                      <p style={{ margin: '0 0 6px 0', color: 'var(--text-sub)' }}>
                        🧭 <strong>Pickup Coordinates:</strong> Lat {delivery.restaurantLatitude != null ? delivery.restaurantLatitude : 'N/A'}, Lng {delivery.restaurantLongitude != null ? delivery.restaurantLongitude : 'N/A'}
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-sub)' }}>
                        🏁 <strong>Dropoff Coordinates:</strong> Lat {delivery.deliveryLatitude != null ? delivery.deliveryLatitude : 'N/A'}, Lng {delivery.deliveryLongitude != null ? delivery.deliveryLongitude : 'N/A'}
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
