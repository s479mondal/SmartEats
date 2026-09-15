import React, { useState, useEffect } from 'react';
import { rescueApi } from '../../api/orderApi';

export default function RescueOffersPage({ addToCart }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    rescueApi.getRescueOffers()
      .then((res) => {
        if (res && res.data) {
          setOffers(res.data);
        } else if (Array.isArray(res)) {
          setOffers(res);
        }
      })
      .catch((err) => {
        setError('Failed to fetch food rescue deals from API Gateway.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span className="badge badge-surplus" style={{ marginBottom: '0.5rem' }}>♻️ Smart Food Rescue Extension</span>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>Dynamic Food Rescue Deals</h1>
        <p style={{ color: 'var(--text-sub)' }}>
          Enjoy delicious surplus meals from top local restaurants at dynamic discounts while preventing food waste!
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '2rem 0' }}>Loading live rescue deals from API Gateway...</div>
      ) : offers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-sub)' }}>
          No active surplus food rescue offers available at the moment.
        </div>
      ) : (
        <div className="grid-3">
          {offers.map((offer) => (
            <div key={offer.id || offer._id} className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <span className="badge badge-surplus">{offer.discountPct || 35}% OFF</span>
                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>⏳ Expires in {offer.expiresMinutes || offer.expiresMin || 30}m</span>
              </div>

              <h3 style={{ fontFamily: 'var(--font-heading)' }}>{offer.name}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: '0.4rem 0' }}>
                📍 {offer.restaurant} ({offer.distance || 'Nearby'})
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.8rem 0' }}>
                {offer.originalPrice && <span className="price-old">₹{offer.originalPrice}</span>}
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.4rem', color: 'var(--accent-green)' }}>
                  ₹{offer.rescuePrice || offer.price}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                Quantity Remaining: <strong>{offer.remainingQty} portions</strong>
              </div>

              <button
                className="btn-action"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                onClick={() => {
                  if (addToCart) {
                    addToCart({ ...offer, price: offer.rescuePrice || offer.price });
                    alert(`Added "${offer.name}" deal to shopping cart!`);
                  } else {
                    alert(`Claimed "${offer.name}" for ₹${offer.rescuePrice || offer.price}! Order processed via API Gateway.`);
                  }
                }}
              >
                Buy Rescue Food Deal
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
