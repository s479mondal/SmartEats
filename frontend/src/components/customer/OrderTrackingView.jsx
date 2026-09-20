import React, { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi, deliveryApi } from '../../api/orderApi';
import { restaurantApi } from '../../api/restaurantApi';
import { computeCombinedOrderStatus, formatOrderTimestamp } from '../../utils/orderStatusUtils';
import { cleanTelUri, formatIndianPhone } from '../../utils/phoneUtils';
import LiveDeliveryMap from './LiveDeliveryMap';

export default function OrderTrackingView({ orderId, initialOrder = null, onClose = null }) {
  const [order, setOrder] = useState(initialOrder);
  const [delivery, setDelivery] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(!initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Polling ref to safely clear timer
  const pollingTimerRef = useRef(null);

  const fetchTrackingData = useCallback(async (isBackground = false) => {
    if (!orderId && !initialOrder?.id) return;
    const targetId = orderId || initialOrder.id;

    if (isBackground) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      // Concurrently fetch order details and delivery info
      const [orderRes, deliveryRes] = await Promise.allSettled([
        orderApi.getOrderById(targetId),
        deliveryApi.getDeliveryByOrderId(targetId)
      ]);

      let currentOrderData = null;
      if (orderRes.status === 'fulfilled' && orderRes.value) {
        currentOrderData = orderRes.value;
        setOrder(currentOrderData);
      } else if (!order) {
        throw new Error('Order details not found or access denied.');
      }

      if (deliveryRes.status === 'fulfilled' && deliveryRes.value) {
        setDelivery(deliveryRes.value);
      } else {
        setDelivery(null);
      }

      // Fetch restaurant name and details if not already loaded
      const restId = currentOrderData?.restaurantId || order?.restaurantId;
      if (restId) {
        try {
          const restData = await restaurantApi.getRestaurantById(restId);
          if (restData) {
            setRestaurant(restData);
          }
        } catch {
          // Non-fatal: keep fallback
        }
      }
    } catch (err) {
      console.warn('Error polling tracking status:', err);
      if (!order) {
        setError(err.response?.data?.message || err.message || 'Unable to load order tracking details.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, initialOrder, order]);

  // Initial Fetch
  useEffect(() => {
    fetchTrackingData(false);
  }, [orderId]);

  // Active Lifecycle Polling Engine
  useEffect(() => {
    const combined = computeCombinedOrderStatus(order, delivery);

    // Stop polling if order has reached a terminal state (DELIVERED, CANCELLED, REJECTED)
    if (combined.isTerminal) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    // Set up lightweight 6-second polling while order is active
    if (!pollingTimerRef.current) {
      pollingTimerRef.current = setInterval(() => {
        fetchTrackingData(true);
      }, 6000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [order, delivery, fetchTrackingData]);

  const handleCopyOrderId = () => {
    const idToCopy = order?.id || orderId;
    if (idToCopy && navigator.clipboard) {
      navigator.clipboard.writeText(idToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const combinedStatus = computeCombinedOrderStatus(order, delivery);

  if (loading && !order) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '3rem 2rem',
        textAlign: 'center',
        border: '1px solid var(--bg-card-border)',
        color: 'var(--text-sub)'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
        <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
          Loading Live Order Tracking...
        </h3>
        <p style={{ fontSize: '0.85rem' }}>Fetching real-time status from kitchen and delivery partners</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '16px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        color: '#f87171'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>⚠️</div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '0.4rem' }}>
          Unable to Load Tracking Information
        </h3>
        <p style={{ fontSize: '0.88rem', maxWidth: '450px', margin: '0 auto 1.5rem auto' }}>{error}</p>
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
          <button
            onClick={() => fetchTrackingData(false)}
            className="cat-btn"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            🔄 Retry
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="cat-btn"
              style={{ background: 'transparent', border: '1px solid var(--bg-card-border)', color: 'var(--text-sub)' }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveOrderId = order?.id || orderId;
  const items = order?.items || [];
  const totalAmount = order?.totalAmount || 0;
  const paymentMethod = order?.paymentMethod || 'COD';
  const paymentStatus = order?.paymentStatus || 'PENDING';
  const orderCreatedAt = order?.createdAt;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--bg-card-border)',
      borderRadius: '20px',
      padding: '1.8rem',
      position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Top Bar: Order Identifier & Close Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '1.2rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem' }}>
            <span className="badge badge-ai" style={{ fontSize: '0.75rem' }}>
              📦 Live Order Tracking
            </span>
            {!combinedStatus.isTerminal && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.74rem',
                color: 'var(--accent-green)',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  background: 'var(--accent-green)',
                  borderRadius: '50%',
                  display: 'inline-block'
                }}></span>
                {refreshing ? 'Refreshing...' : 'Live Polling Active'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: '#fff', margin: 0 }}>
              Order #{effectiveOrderId ? effectiveOrderId.substring(0, 10) : '---'}
            </h2>
            <button
              onClick={handleCopyOrderId}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: copied ? 'var(--accent-green)' : 'var(--text-sub)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Copy Full Order ID"
            >
              {copied ? 'Copied! ✓' : '📋 Copy ID'}
            </button>
          </div>

          <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', marginTop: '4px' }}>
            Placed: <strong>{formatOrderTimestamp(orderCreatedAt)}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => fetchTrackingData(true)}
            disabled={refreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}
          >
            🔄 {refreshing ? 'Updating...' : 'Refresh'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 800
              }}
              title="Close Tracking Modal"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Status Headline Banner */}
      <div style={{
        background: combinedStatus.isError
          ? 'rgba(239, 68, 68, 0.12)'
          : (combinedStatus.isDelivered
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(0, 242, 254, 0.08)'),
        border: `1px solid ${combinedStatus.badgeColor}`,
        borderRadius: '16px',
        padding: '1.4rem',
        marginBottom: '1.8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '2.4rem',
            background: 'rgba(255, 255, 255, 0.05)',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${combinedStatus.badgeColor}`
          }}>
            {combinedStatus.isError ? '❌' : (combinedStatus.isDelivered ? '🎉' : '⏱️')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: combinedStatus.badgeColor,
                color: (combinedStatus.isDelivered || combinedStatus.isError) ? '#fff' : '#000',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                {combinedStatus.currentLabel}
              </span>
              {restaurant?.name && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                  from <strong>{restaurant.name}</strong>
                </span>
              )}
            </div>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.25rem',
              color: '#fff',
              marginTop: '4px',
              marginBottom: '2px'
            }}>
              {combinedStatus.currentDescription}
            </h3>
            {!combinedStatus.isTerminal && (
              <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', margin: 0 }}>
                Status updates in real-time as your kitchen prepares and delivery partner travels.
              </p>
            )}
          </div>
        </div>

        {/* Progress Metric Badge */}
        {!combinedStatus.isError && (
          <div style={{
            textAlign: 'right',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 600 }}>
              Progress
            </div>
            <div style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: combinedStatus.badgeColor,
              fontFamily: 'var(--font-heading)'
            }}>
              {combinedStatus.progressPct}%
            </div>
          </div>
        )}
      </div>

      {/* 8-Step Visual Stepper / Lifecycle Progress */}
      {!combinedStatus.isError && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.8rem'
        }}>
          <h4 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.95rem',
            color: '#cbd5e1',
            marginBottom: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🧭</span>
            <span>Order Lifecycle Journey</span>
          </h4>

          {/* Stepper Steps Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '12px',
            position: 'relative'
          }}>
            {combinedStatus.steps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isCurrent = step.status === 'current';
              const isUpcoming = step.status === 'upcoming';

              let borderColor = 'rgba(255, 255, 255, 0.08)';
              let bg = 'rgba(255, 255, 255, 0.02)';
              let iconColor = 'var(--text-sub)';

              if (isCompleted) {
                borderColor = 'rgba(16, 185, 129, 0.4)';
                bg = 'rgba(16, 185, 129, 0.08)';
                iconColor = 'var(--accent-green)';
              } else if (isCurrent) {
                borderColor = 'var(--accent-cyan)';
                bg = 'rgba(0, 242, 254, 0.12)';
                iconColor = 'var(--accent-cyan)';
              }

              return (
                <div
                  key={step.key}
                  style={{
                    border: `1px solid ${borderColor}`,
                    background: bg,
                    borderRadius: '12px',
                    padding: '10px 8px',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: isCurrent ? '0 0 15px rgba(0, 242, 254, 0.2)' : 'none',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isCompleted
                      ? 'var(--accent-green)'
                      : (isCurrent ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)'),
                    color: isCompleted || isCurrent ? '#000' : 'var(--text-sub)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 6px auto'
                  }}>
                    {isCompleted ? '✓' : (isCurrent ? '●' : idx + 1)}
                  </div>

                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? '#fff' : (isCompleted ? '#e2e8f0' : 'var(--text-sub)'),
                    lineHeight: '1.2',
                    marginBottom: '2px'
                  }}>
                    {step.title}
                  </div>

                  <div style={{
                    fontSize: '0.68rem',
                    color: isCompleted
                      ? 'var(--accent-green)'
                      : (isCurrent ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.3)'),
                    fontWeight: 700
                  }}>
                    {isCompleted ? 'Done' : (isCurrent ? 'In Progress' : 'Pending')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 8.3C: Customer-Facing Live Delivery Map */}
      {!combinedStatus.isError && (delivery != null || combinedStatus.activeStepIndex >= 3) && (
        <LiveDeliveryMap
          delivery={delivery}
          restaurantName={restaurant?.name || order?.restaurantId}
          customerAddress={order?.deliveryAddress}
        />
      )}

      {/* Details Grid: 1. Delivery & Driver Info, 2. Ordered Items & Bill */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Card 1: Delivery & Kitchen Details */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.3rem'
        }}>
          <h4 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1rem',
            color: '#fff',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🛵</span>
            <span>Delivery & Driver Information</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ color: 'var(--text-sub)' }}>Restaurant:</span>
              <strong style={{ color: '#fff' }}>{restaurant?.name || order?.restaurantId || 'Kitchen Partner'}</strong>
            </div>

            {restaurant?.address && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-sub)' }}>Kitchen Address:</span>
                <span style={{ color: '#cbd5e1', textAlign: 'right', maxWidth: '60%' }}>{restaurant.address}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ color: 'var(--text-sub)' }}>Kitchen Contact:</span>
              {cleanTelUri(restaurant?.phone) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>{formatIndianPhone(restaurant.phone)}</span>
                  <a
                    href={cleanTelUri(restaurant.phone)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: 'var(--accent-green)',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    title={`Call ${restaurant?.name || 'Restaurant'}`}
                  >
                    📞 Call Restaurant
                  </a>
                </div>
              ) : (
                <span style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>Phone not available</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-sub)' }}>Delivery Status:</span>
              <span style={{
                color: delivery?.status ? 'var(--accent-cyan)' : '#f59e0b',
                fontWeight: 700
              }}>
                {delivery?.status ? String(delivery.status).replace(/_/g, ' ') : (combinedStatus.activeStepIndex >= 1 ? 'Assigning nearby rider...' : 'Waiting for kitchen')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ color: 'var(--text-sub)' }}>Assigned Driver:</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>
                {delivery?.driverName
                  ? `🛵 ${delivery.driverName}`
                  : (delivery?.deliveryPartnerEmail
                      ? `🛵 Partner (${delivery.deliveryPartnerEmail.split('@')[0]})`
                      : (delivery?.status === 'ASSIGNED' ? 'Rider Matched' : 'Pending Match'))}
              </span>
            </div>

            {(delivery?.deliveryPartnerEmail || delivery?.driverName || (delivery?.status && ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(String(delivery.status)))) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ color: 'var(--text-sub)' }}>Driver Contact:</span>
                {cleanTelUri(delivery?.driverPhone) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>{formatIndianPhone(delivery.driverPhone)}</span>
                    <a
                      href={cleanTelUri(delivery.driverPhone)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(0, 242, 254, 0.15)',
                        border: '1px solid rgba(0, 242, 254, 0.35)',
                        color: 'var(--accent-cyan)',
                        padding: '3px 10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      title={`Call Driver ${delivery?.driverName || ''}`}
                    >
                      📞 Call Driver
                    </a>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>Driver phone not available</span>
                )}
              </div>
            )}

            {delivery?.driverCurrentLatitude != null && delivery?.driverCurrentLongitude != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-sub)' }}>Driver Live GPS:</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.8rem' }}>
                  🛰️ [{Number(delivery.driverCurrentLatitude).toFixed(4)}, {Number(delivery.driverCurrentLongitude).toFixed(4)}]
                </span>
              </div>
            )}

            {(order?.deliveryLatitude && order?.deliveryLongitude) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-sub)' }}>Destination GPS:</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.8rem' }}>
                  📍 [{Number(order.deliveryLatitude).toFixed(4)}, {Number(order.deliveryLongitude).toFixed(4)}]
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Ordered Items Breakdown & Payment */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.3rem'
        }}>
          <h4 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1rem',
            color: '#fff',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🍽️</span>
            <span>Items & Payment Summary</span>
          </h4>

          {/* Items List */}
          <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '1rem', paddingRight: '4px' }}>
            {items.length === 0 ? (
              <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>No item details available.</p>
            ) : (
              items.map((item, i) => (
                <div key={item.id || item.menuItemId || i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ color: 'var(--text-sub)', marginLeft: '6px', fontSize: '0.78rem' }}>
                      x{item.quantity || item.qty || 1}
                    </span>
                  </div>
                  <span style={{ color: '#cbd5e1', fontWeight: 700 }}>
                    ₹{((item.price || 0) * (item.quantity || item.qty || 1))}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Payment & Bill Summary */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-sub)' }}>Payment Method:</span>
              <strong style={{ color: '#fff' }}>
                {paymentMethod === 'COD' ? '💵 Cash on Delivery (COD)' : '💳 Online Payment (Razorpay)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-sub)' }}>Payment Status:</span>
              <span style={{
                color: paymentStatus === 'PAID' ? 'var(--accent-green)' : '#f59e0b',
                fontWeight: 700,
                fontSize: '0.82rem'
              }}>
                {paymentStatus === 'PAID' ? 'PAID ✓' : (paymentMethod === 'COD' ? 'PAYMENT ON DELIVERY' : 'PENDING')}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px dashed rgba(255,255,255,0.1)',
              paddingTop: '0.6rem',
              marginTop: '4px'
            }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>Total Paid / Due:</span>
              <span style={{
                color: 'var(--accent-cyan)',
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 800
              }}>
                ₹{totalAmount}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
