import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom Map Markers
const restaurantIcon = L.divIcon({
  className: 'smarteats-rest-pin-wrapper',
  html: `
    <div style="
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #000;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5);
      border: 2px solid #fff;
    ">
      🍲
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20]
});

const customerIcon = L.divIcon({
  className: 'smarteats-cust-pin-wrapper',
  html: `
    <div style="
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
      border: 2px solid #fff;
    ">
      🏠
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20]
});

const driverLiveIcon = L.divIcon({
  className: 'smarteats-driver-live-pin-wrapper',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(0, 242, 254, 0.25);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
        color: #000;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 15px rgba(0, 242, 254, 0.6);
        border: 2px solid #fff;
        position: relative;
        z-index: 2;
      ">
        🛵
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -24]
});

// Auto-Fit Map Bounds Component
function MapBoundsManager({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      map.flyTo(points[0], 15, { duration: 1.2 });
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
        animate: true,
        duration: 1.2
      });
    }
  }, [JSON.stringify(points), map]);

  return null;
}

export default function LiveDeliveryMap({ delivery, restaurantName, customerAddress }) {
  const restLat = delivery?.restaurantLatitude;
  const restLng = delivery?.restaurantLongitude;
  const delLat = delivery?.deliveryLatitude;
  const delLng = delivery?.deliveryLongitude;
  const driverLat = delivery?.driverCurrentLatitude;
  const driverLng = delivery?.driverCurrentLongitude;
  const lastUpdate = delivery?.driverLastLocationUpdate;
  const accuracy = delivery?.driverLocationAccuracyMeters;

  // Compute all valid geographic coordinates for bounding box
  const validPoints = useMemo(() => {
    const pts = [];
    if (restLat != null && restLng != null && !(restLat === 0 && restLng === 0)) {
      pts.push([restLat, restLng]);
    }
    if (delLat != null && delLng != null && !(delLat === 0 && delLng === 0)) {
      pts.push([delLat, delLng]);
    }
    if (driverLat != null && driverLng != null && !(driverLat === 0 && driverLng === 0)) {
      pts.push([driverLat, driverLng]);
    }
    return pts;
  }, [restLat, restLng, delLat, delLng, driverLat, driverLng]);

  // Initial center fallback
  const defaultCenter = validPoints.length > 0 ? validPoints[0] : [12.9716, 77.5946];

  // Calculate location freshness
  const getFreshness = () => {
    if (!lastUpdate) return { label: 'Location pending', status: 'PENDING', color: '#f59e0b' };
    const updateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    const secondsDiff = Math.max(0, Math.floor((now - updateTime) / 1000));

    if (secondsDiff <= 60) {
      return {
        label: `Live (Updated ${secondsDiff}s ago)`,
        status: 'LIVE',
        color: 'var(--accent-green)',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeBorder: 'rgba(16, 185, 129, 0.3)'
      };
    } else if (secondsDiff <= 360) {
      const mins = Math.floor(secondsDiff / 60);
      return {
        label: `Updating slowly (Updated ${mins}m ago)`,
        status: 'SLOW',
        color: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeBorder: 'rgba(245, 158, 11, 0.3)'
      };
    } else {
      const mins = Math.floor(secondsDiff / 60);
      return {
        label: `Last known location (${mins}m ago)`,
        status: 'STALE',
        color: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeBorder: 'rgba(239, 68, 68, 0.3)'
      };
    }
  };

  const freshness = getFreshness();
  const hasLiveDriver = driverLat != null && driverLng != null && !(driverLat === 0 && driverLng === 0);

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid var(--bg-card-border)',
      borderRadius: '16px',
      padding: '1.25rem',
      marginBottom: '1.5rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Map Header & Live Telemetry Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.8rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>🗺️</span>
          <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            Live Delivery Tracking Map
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasLiveDriver ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: freshness.color,
              background: freshness.badgeBg,
              border: `1px solid ${freshness.badgeBorder}`,
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 700
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: freshness.color,
                display: 'inline-block',
                boxShadow: `0 0 6px ${freshness.color}`
              }}></span>
              <span>🛵 Rider: {freshness.label}</span>
              {accuracy != null && (
                <span style={{ opacity: 0.8, fontSize: '0.72rem', marginLeft: '4px' }}>
                  (±{Math.round(accuracy)}m)
                </span>
              )}
            </div>
          ) : (
            <div style={{
              fontSize: '0.78rem',
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 600
            }}>
              🛵 Rider assigned (Awaiting live GPS beacon)
            </div>
          )}
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div style={{
        height: '340px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <MapContainer
          center={defaultCenter}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#1e293b' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsManager points={validPoints} />

          {/* 1. Restaurant Marker */}
          {restLat != null && restLng != null && !(restLat === 0 && restLng === 0) && (
            <Marker position={[restLat, restLng]} icon={restaurantIcon}>
              <Popup>
                <div style={{ color: '#000', fontSize: '0.85rem' }}>
                  <strong>🍲 {restaurantName || 'Restaurant'}</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#475569' }}>
                    Pickup Location
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 2. Customer Destination Marker */}
          {delLat != null && delLng != null && !(delLat === 0 && delLng === 0) && (
            <Marker position={[delLat, delLng]} icon={customerIcon}>
              <Popup>
                <div style={{ color: '#000', fontSize: '0.85rem' }}>
                  <strong>🏠 Delivery Destination</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#475569' }}>
                    {customerAddress || 'Your Delivery Address'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* 3. Live Driver Operational Marker (ONLY when current GPS is available) */}
          {hasLiveDriver && (
            <Marker position={[driverLat, driverLng]} icon={driverLiveIcon}>
              <Popup>
                <div style={{ color: '#000', fontSize: '0.85rem' }}>
                  <strong>🛵 Delivery Partner ({delivery.driverName || 'Rider'})</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    ● {freshness.label}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Map Legend Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.25)',
        padding: '0.6rem 1rem',
        borderRadius: '8px',
        marginTop: '0.8rem',
        fontSize: '0.76rem',
        color: 'var(--text-sub)',
        flexWrap: 'wrap',
        gap: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>🍲</span> <strong>Restaurant (Pickup)</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>🛵</span> <strong style={{ color: hasLiveDriver ? 'var(--accent-cyan)' : 'inherit' }}>Live Delivery Partner</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>🏠</span> <strong>Your Address (Dropoff)</strong>
        </div>
      </div>
    </div>
  );
}
