import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  Compass,
  Loader2,
  Navigation,
  Layers,
  Info,
  Check
} from 'lucide-react';
import { authApi } from '../../api/authApi';
import LocationSearch from './LocationSearch';

// Default India geographic fallback center (Nagpur area)
const DEFAULT_INDIA_CENTER = [20.5937, 78.9629];
const DEFAULT_OVERVIEW_ZOOM = 5;
const DEFAULT_LOCAL_ZOOM = 16;

// Custom animated Leaflet DivIcon for pinpoint rooftop accuracy
const customPinIcon = L.divIcon({
  className: 'smarteats-custom-pin-wrapper',
  html: `
    <div class="smarteats-custom-pin">
      <div class="smarteats-pin-icon">
        <div class="smarteats-pin-dot"></div>
      </div>
      <div class="smarteats-pin-pulse"></div>
    </div>
  `,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42]
});

// Helper component to smoothly pan/zoom map on coordinate changes
function MapRecenterController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || DEFAULT_LOCAL_ZOOM, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Helper component to handle clicking on the map canvas to place/reposition marker
function MapClickHandler({ onMapClick, disabled }) {
  useMapEvents({
    click(e) {
      if (!disabled && onMapClick) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

/**
 * Reusable LocationPicker Component for SmartEats
 * 
 * Supports:
 * - Address Search (Nominatim via Gateway)
 * - PIN code lookup (India Post API via Gateway)
 * - Browser GPS (navigator.geolocation)
 * - Draggable marker on Leaflet + OpenStreetMap canvas
 * - GPS accuracy circle
 * - User confirmation workflow (preserves human-readable address & separates coordinates)
 */
export default function LocationPicker({
  initialLocation = null,
  onLocationConfirm,
  onLocationChange,
  showSearch = true,
  title = 'Pin Precise Location',
  description = 'Search your locality or use GPS, then drag the marker to your exact doorstep.',
  height = '340px',
  disabled = false,
  readOnly = false
}) {
  // Marker & Coordinate state
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation?.latitude && initialLocation?.longitude
      ? [initialLocation.latitude, initialLocation.longitude]
      : null
  );
  const [mapCenter, setMapCenter] = useState(
    initialLocation?.latitude && initialLocation?.longitude
      ? [initialLocation.latitude, initialLocation.longitude]
      : DEFAULT_INDIA_CENTER
  );
  const [zoomLevel, setZoomLevel] = useState(
    initialLocation?.latitude && initialLocation?.longitude ? DEFAULT_LOCAL_ZOOM : DEFAULT_OVERVIEW_ZOOM
  );
  const [accuracy, setAccuracy] = useState(initialLocation?.accuracy || null);

  // Provenance & Confirmation state
  const [locationSource, setLocationSource] = useState(
    initialLocation?.locationSource || (initialLocation?.latitude ? 'USER_CONFIRMED_MAP' : 'INITIAL')
  );
  const [isConfirmed, setIsConfirmed] = useState(Boolean(initialLocation?.isConfirmed || initialLocation?.latitude));
  const [confirmedData, setConfirmedData] = useState(initialLocation || null);

  // Discovery search inputs
  const [searchAddress, setSearchAddress] = useState(initialLocation?.address || '');
  const [selectedSearchCandidate, setSelectedSearchCandidate] = useState(null);

  // Administrative attributes (resolved or user-provided)
  const [locationDetails, setLocationDetails] = useState({
    address: initialLocation?.address || '',
    city: initialLocation?.city || '',
    district: initialLocation?.district || '',
    state: initialLocation?.state || '',
    pincode: initialLocation?.pincode || ''
  });

  // Loading & status states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [reverseLoading, setReverseLoading] = useState(false);

  const markerRef = useRef(null);
  const reverseAbortRef = useRef(null);

  // Trigger live updates to parent if requested
  const notifyChange = useCallback((updatedPayload) => {
    if (onLocationChange) {
      onLocationChange(updatedPayload);
    }
  }, [onLocationChange]);

  // Reverse geocode a point when marker is manually dragged or clicked
  const performReverseGeocode = useCallback(async (lat, lng) => {
    if (reverseAbortRef.current) {
      reverseAbortRef.current.abort();
    }
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    setReverseLoading(true);

    try {
      const res = await authApi.reverseGeocode(lat, lng, controller.signal);
      if (res && res.addressDetails) {
        const details = res.addressDetails;
        const resolvedCity = details.city || details.town || details.village || details.suburb || '';
        const resolvedDistrict = details.state_district || details.county || '';
        const resolvedState = details.state || '';
        const resolvedPincode = details.postcode ? details.postcode.replace(/\D/g, '').slice(0, 6) : '';

        setLocationDetails((prev) => ({
          ...prev,
          city: resolvedCity || prev.city,
          district: resolvedDistrict || prev.district,
          state: resolvedState || prev.state,
          pincode: resolvedPincode || prev.pincode,
          address: res.displayName || prev.address
        }));
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.warn('Reverse geocode warning:', err);
      }
    } finally {
      setReverseLoading(false);
    }
  }, []);

  // Handle Address Search candidate selection
  const handleCandidateSelect = (candidate) => {
    if (!candidate) return;
    setSelectedSearchCandidate(candidate);

    const lat = parseFloat(candidate.latitude);
    const lon = parseFloat(candidate.longitude);

    if (!isNaN(lat) && !isNaN(lon)) {
      const newPos = [lat, lon];
      setMarkerPosition(newPos);
      setMapCenter(newPos);
      setZoomLevel(DEFAULT_LOCAL_ZOOM);
      setAccuracy(null);
      setLocationSource('SEARCH_CANDIDATE');
      setIsConfirmed(false);
      setGpsError(null);

      // Extract administrative fields
      const details = candidate.addressDetails || {};
      const resolvedCity = details.city || details.town || details.village || details.suburb || '';
      const resolvedDistrict = details.state_district || details.county || '';
      const resolvedState = details.state || '';
      const resolvedPincode = details.postcode ? details.postcode.replace(/\D/g, '').slice(0, 6) : '';

      const updatedDetails = {
        address: candidate.displayName || searchAddress,
        city: resolvedCity || locationDetails.city,
        district: resolvedDistrict || locationDetails.district,
        state: resolvedState || locationDetails.state,
        pincode: resolvedPincode || locationDetails.pincode
      };
      setLocationDetails(updatedDetails);

      notifyChange({
        latitude: lat,
        longitude: lon,
        ...updatedDetails,
        locationSource: 'SEARCH_CANDIDATE',
        accuracy: null,
        isConfirmed: false
      });
    }
  };

  // Handle Marker Drag End
  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker != null) {
      const latlng = marker.getLatLng();
      const newPos = [latlng.lat, latlng.lng];
      setMarkerPosition(newPos);
      setLocationSource('USER_DRAGGED_PIN');
      setIsConfirmed(false);
      setAccuracy(null);

      performReverseGeocode(latlng.lat, latlng.lng);

      notifyChange({
        latitude: latlng.lat,
        longitude: latlng.lng,
        ...locationDetails,
        locationSource: 'USER_DRAGGED_PIN',
        accuracy: null,
        isConfirmed: false
      });
    }
  };

  // Handle direct map click to reposition pin
  const handleMapClick = (newPos) => {
    if (readOnly || disabled) return;
    setMarkerPosition(newPos);
    setLocationSource('USER_DRAGGED_PIN');
    setIsConfirmed(false);
    setAccuracy(null);

    performReverseGeocode(newPos[0], newPos[1]);

    notifyChange({
      latitude: newPos[0],
      longitude: newPos[1],
      ...locationDetails,
      locationSource: 'USER_DRAGGED_PIN',
      accuracy: null,
      isConfirmed: false
    });
  };

  // Handle Browser GPS "Use Current Location"
  const handleUseCurrentLocation = () => {
    if (disabled || readOnly) return;
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your current browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);

        const newPos = [lat, lon];
        setMarkerPosition(newPos);
        setMapCenter(newPos);
        setZoomLevel(DEFAULT_LOCAL_ZOOM);
        setAccuracy(acc);
        setLocationSource('GPS_DEVICE');
        setIsConfirmed(false);
        setGpsLoading(false);

        performReverseGeocode(lat, lon);

        notifyChange({
          latitude: lat,
          longitude: lon,
          ...locationDetails,
          locationSource: 'GPS_DEVICE',
          accuracy: acc,
          isConfirmed: false
        });
      },
      (error) => {
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please search your address manually.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('GPS position unavailable. Please search your address manually.');
            break;
          case error.TIMEOUT:
            setGpsError('GPS request timed out. Please retry or search your address.');
            break;
          default:
            setGpsError('Unable to retrieve GPS coordinates. Please search your address.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  // Handle "Confirm Location" Action
  const handleConfirmLocation = () => {
    if (!markerPosition || disabled) return;

    const payload = {
      latitude: markerPosition[0],
      longitude: markerPosition[1],
      address: locationDetails.address || searchAddress,
      city: locationDetails.city,
      district: locationDetails.district,
      state: locationDetails.state,
      pincode: locationDetails.pincode,
      locationSource: 'USER_CONFIRMED_MAP',
      accuracy: accuracy || null,
      isConfirmed: true,
      confirmedAt: new Date().toISOString()
    };

    setIsConfirmed(true);
    setLocationSource('USER_CONFIRMED_MAP');
    setConfirmedData(payload);

    if (onLocationConfirm) {
      onLocationConfirm(payload);
    }
  };

  // Human readable provenance label
  const getSourceBadge = () => {
    if (isConfirmed) {
      return {
        label: '✓ Confirmed Location',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: '#10b981',
        text: '#34d399'
      };
    }
    switch (locationSource) {
      case 'SEARCH_CANDIDATE':
        return {
          label: selectedSearchCandidate?.fallbackLevel
            ? `📍 Broader Reference: ${selectedSearchCandidate.fallbackLevel}`
            : '📍 Search Candidate',
          bg: selectedSearchCandidate?.fallbackLevel ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
          border: selectedSearchCandidate?.fallbackLevel ? '#f59e0b' : '#38bdf8',
          text: selectedSearchCandidate?.fallbackLevel ? '#fbbf24' : '#38bdf8'
        };
      case 'GPS_DEVICE':
        return {
          label: `🛰️ GPS Device (${accuracy ? `±${accuracy}m` : 'Active'})`,
          bg: 'rgba(168, 85, 247, 0.15)',
          border: '#a855f7',
          text: '#c084fc'
        };
      case 'USER_DRAGGED_PIN':
        return {
          label: '🎯 User Adjusted Marker',
          bg: 'rgba(255, 94, 58, 0.15)',
          border: '#ff5e3a',
          text: '#ff5e3a'
        };
      default:
        return {
          label: 'Map Overview',
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.15)',
          text: 'var(--text-sub)'
        };
    }
  };

  const badge = getSourceBadge();

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--bg-card-border)',
        borderRadius: '16px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h5 style={{ color: '#fff', fontSize: '0.98rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={18} color="var(--primary)" />
            {title}
          </h5>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.78rem', margin: '3px 0 0 0' }}>
            {description}
          </p>
        </div>

        {/* GPS Quick Action Button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={gpsLoading || disabled}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: gpsLoading || disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
            {gpsLoading ? 'Locating...' : 'Use Current Location'}
          </button>
        )}
      </div>

      {/* GPS Error Alert */}
      {gpsError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '0.5rem 0.8rem',
            borderRadius: '8px',
            fontSize: '0.76rem',
            marginBottom: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertCircle size={14} />
          {gpsError}
        </div>
      )}

      {/* Embedded Location Search (if enabled) */}
      {showSearch && !readOnly && (
        <div style={{ marginBottom: '0.8rem' }}>
          <LocationSearch
            address={searchAddress}
            onAddressChange={setSearchAddress}
            selectedLocation={selectedSearchCandidate}
            onLocationSelect={handleCandidateSelect}
            label="Search Locality / Street"
            placeholder="e.g. Harinathpur, Kaliganj, Nadia or Tansen Road, Durgapur"
            disabled={disabled}
          />
        </div>
      )}

      {/* Provenance & Status Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div
          style={{
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            color: badge.text,
            padding: '3px 9px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          {badge.label}
        </div>

        {reverseLoading && (
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={12} className="animate-spin" />
            Updating address details...
          </span>
        )}
      </div>

      {/* Leaflet Map Canvas */}
      <div
        className="smarteats-map-container"
        style={{
          height: height,
          width: '100%',
          position: 'relative',
          marginBottom: '0.8rem',
          zIndex: 10
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={zoomLevel}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#1e293b' }}
        >
          {/* OpenStreetMap Standard Tiles with Attribution */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Smooth Recenter Controller */}
          <MapRecenterController center={mapCenter} zoom={zoomLevel} />

          {/* Map Click Listener */}
          <MapClickHandler onMapClick={handleMapClick} disabled={disabled || readOnly} />

          {/* Draggable Marker Pin */}
          {markerPosition && (
            <Marker
              position={markerPosition}
              draggable={!readOnly && !disabled}
              eventHandlers={{
                dragend: handleMarkerDragEnd
              }}
              ref={markerRef}
              icon={customPinIcon}
            />
          )}

          {/* GPS Accuracy Circle */}
          {markerPosition && accuracy && (
            <Circle
              center={markerPosition}
              radius={accuracy}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.12,
                weight: 1.5
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Coordinate Readout & Confirmation Bar */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0.8rem 1rem',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.8rem'
        }}
      >
        {/* Coordinates Display */}
        <div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-sub)', marginBottom: '2px' }}>
            Selected Geographic Coordinates:
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>
            {markerPosition
              ? `Lat: ${markerPosition[0].toFixed(6)}, Lon: ${markerPosition[1].toFixed(6)}`
              : 'Click map or search to place pin'}
          </div>
        </div>

        {/* Confirmation Action Button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleConfirmLocation}
            disabled={!markerPosition || disabled}
            style={{
              background: isConfirmed
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #ff5e3a 0%, #ff2a5f 100%)',
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: !markerPosition || disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isConfirmed
                ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                : '0 4px 12px rgba(255, 94, 58, 0.4)',
              transition: 'all 0.2s ease',
              opacity: !markerPosition || disabled ? 0.6 : 1
            }}
          >
            {isConfirmed ? <Check size={16} /> : <CheckCircle2 size={16} />}
            {isConfirmed ? 'Location Confirmed' : 'Confirm Location'}
          </button>
        )}
      </div>
    </div>
  );
}
