import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Compass, Loader2, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { authApi } from '../../api/authApi';

export default function LocationSearch({
  address = '',
  onAddressChange,
  selectedLocation = null,
  onLocationSelect,
  placeholder = 'e.g. Harinathpur, Kaliganj, Nadia',
  label = 'Delivery Address / Location',
  required = false,
  disabled = false
}) {
  const [inputValue, setInputValue] = useState(address);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const currentRequestIdRef = useRef(0);
  const activeRequestRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Keep input value synced if parent changes address externally
  useEffect(() => {
    setInputValue(address || '');
  }, [address]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce & abort controllers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (activeRequestRef.current) activeRequestRef.current.abort();
    };
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (onAddressChange) {
      onAddressChange(newValue);
    }

    setSelectedIndex(-1);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = newValue.trim();
    if (trimmed.length < 3) {
      currentRequestIdRef.current++;
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      setHasSearched(false);
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
      return;
    }

    setLoading(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      const thisRequestId = ++currentRequestIdRef.current;

      // Abort any prior in-flight request
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }

      const controller = new AbortController();
      activeRequestRef.current = controller;

      try {
        const results = await authApi.searchLocations(trimmed, controller.signal);
        if (thisRequestId === currentRequestIdRef.current) {
          setSuggestions(Array.isArray(results) ? results : []);
          setHasSearched(true);
          setError(null);
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        if (thisRequestId === currentRequestIdRef.current) {
          console.error('Location search error:', err);
          setError('Unable to search locations. Please try again.');
          setSuggestions([]);
          setHasSearched(true);
        }
      } finally {
        if (thisRequestId === currentRequestIdRef.current) {
          setLoading(false);
        }
      }
    }, 400);
  };

  const handleSelectCandidate = (candidate) => {
    if (onLocationSelect) {
      onLocationSelect(candidate);
    }
    setIsOpen(false);
    setSuggestions([]);

    // If user's input was empty, populate with display name
    if (!inputValue || !inputValue.trim()) {
      setInputValue(candidate.displayName);
      if (onAddressChange) {
        onAddressChange(candidate.displayName);
      }
    }
  };

  const handleClearSelection = () => {
    if (onLocationSelect) {
      onLocationSelect(null);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectCandidate(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const hasParentCandidates = suggestions.some(
    (item) => item.isParentArea || item.parentArea
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-main, #f8fafc)'
          }}
        >
          {label} {required && <span style={{ color: 'var(--primary, #ff5e3a)' }}>*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '14px',
            color: 'var(--text-sub, #94a3b8)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="location-suggestions-list"
          aria-activedescendant={selectedIndex >= 0 ? `location-suggestion-${selectedIndex}` : undefined}
          aria-label={label}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue.trim().length >= 3 && (suggestions.length > 0 || loading || error || hasSearched)) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          style={{
            width: '100%',
            padding: '0.8rem 1rem 0.8rem 2.6rem',
            backgroundColor: 'rgba(22, 31, 49, 0.85)',
            border: isOpen ? '1px solid var(--accent-cyan, #00f2fe)' : '1px solid var(--bg-card-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isOpen ? '0 0 12px rgba(0, 242, 254, 0.2)' : 'none'
          }}
        />

        {loading && (
          <Loader2
            size={18}
            className="animate-spin"
            style={{
              position: 'absolute',
              right: '14px',
              color: 'var(--accent-cyan, #00f2fe)',
              animation: 'spin 1s linear infinite'
            }}
          />
        )}
      </div>

      {/* Selected Location Reference Card */}
      {selectedLocation && (
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.65rem 0.85rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--accent-green, #10b981)', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-green, #10b981)' }}>
                  Location Reference Selected
                </span>
                {(selectedLocation.isParentArea || selectedLocation.parentArea) && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 7px',
                      backgroundColor: 'rgba(255, 153, 0, 0.25)',
                      border: '1px solid rgba(255, 153, 0, 0.5)',
                      color: '#ffb74d',
                      borderRadius: '12px',
                      fontWeight: 600
                    }}
                  >
                    Broader Area
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', color: 'var(--text-sub, #94a3b8)', fontSize: '0.8rem', lineHeight: '1.2' }}>
                {selectedLocation.displayName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            title="Clear location selection"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub, #94a3b8)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '0.5rem'
          }}
          id="location-suggestions-list"
          role="listbox"
          aria-label="Location suggestions"
        >
          {loading && suggestions.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-sub, #94a3b8)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Searching locations...
            </div>
          )}

          {error && (
            <div style={{ padding: '0.8rem 1rem', color: '#ff6b6b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {!loading && !error && hasSearched && suggestions.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-sub, #94a3b8)', fontSize: '0.875rem' }}>
              No matching locations found.
            </div>
          )}

          {/* Parent Area Banner */}
          {!loading && hasParentCandidates && (
            <div
              style={{
                margin: '0.25rem 0.25rem 0.5rem 0.25rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(255, 153, 0, 0.12)',
                border: '1px solid rgba(255, 153, 0, 0.3)',
                borderRadius: '8px',
                color: '#ffb74d',
                fontSize: '0.78rem',
                lineHeight: '1.3',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.4rem'
              }}
            >
              <Compass size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                Exact location was not found in the map database. You can choose a broader area for now; a map pin will be available in the next location step.
              </span>
            </div>
          )}

          {/* Suggestions List */}
          {suggestions.map((item, index) => {
            const isParent = item.isParentArea || item.parentArea;
            const isHighlighted = index === selectedIndex;

            return (
              <div
                key={index}
                id={`location-suggestion-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onClick={() => handleSelectCandidate(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: isHighlighted ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                  border: isHighlighted ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid transparent',
                  marginBottom: '2px',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  {isParent ? (
                    <Compass size={18} style={{ color: '#ffb74d', marginTop: '2px', flexShrink: 0 }} />
                  ) : (
                    <MapPin size={18} style={{ color: 'var(--accent-cyan, #00f2fe)', marginTop: '2px', flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <p
                        style={{
                          margin: 0,
                          color: '#fff',
                          fontSize: '0.88rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.displayName}
                      </p>
                      {isParent && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            backgroundColor: 'rgba(255, 153, 0, 0.2)',
                            color: '#ffb74d',
                            borderRadius: '10px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Broader Area
                        </span>
                      )}
                    </div>

                    {item.matchedQuery && item.matchedQuery !== inputValue.trim() && (
                      <p style={{ margin: '2px 0 0 0', color: 'var(--text-sub, #94a3b8)', fontSize: '0.76rem' }}>
                        Matched via parent query: &quot;{item.matchedQuery}&quot;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
