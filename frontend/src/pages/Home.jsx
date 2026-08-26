import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/hero/Hero';
import Features from '../components/features/Features';
import RestaurantCard from '../components/restaurant/RestaurantCard';
import RescueCard from '../components/rescue/RescueCard';
import Workflow from '../components/workflow/Workflow';
import RoleSections from '../components/role-sections/RoleSections';
import { sampleRestaurants } from '../data/restaurants';
import { sampleRescueOffers } from '../data/rescueOffers';

export default function Home() {
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleViewOffer = (offer) => {
    setSelectedOffer(offer);
  };

  const handleTryPurchase = () => {
    setSelectedOffer(null);
    setShowLoginModal(true);
  };

  const handleScroll = (id) => {
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      background: '#f8fafc',
      color: '#1e293b',
      minHeight: '100vh',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Wrapper to set font variables correctly in this theme context */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
        
        {/* Hero Banner Component */}
        <Hero 
          onExploreRestaurants={() => handleScroll('#restaurants')}
          onExploreRescue={() => handleScroll('#rescue')}
        />

        {/* Why SmartEats Features */}
        <Features />

        {/* Restaurant Preview Section */}
        <section id="restaurants" style={{ padding: '4rem 0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.25rem',
                fontWeight: 800,
                color: '#0f172a',
                marginBottom: '0.4rem'
              }}>
                Explore Restaurants
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Order from local culinary favorites matching your delivery coordinates.
              </p>
            </div>
            
            <button
              onClick={() => handleScroll('#roles')}
              style={{
                background: 'rgba(15, 23, 42, 0.05)',
                border: 'none',
                color: '#0f172a',
                padding: '0.6rem 1.4rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(15, 23, 42, 0.1)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(15, 23, 42, 0.05)'}
            >
              View All Restaurants ➔
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {sampleRestaurants.slice(0, 3).map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>

        {/* Smart Food Rescue Preview Section */}
        <section id="rescue" style={{
          padding: '4rem 0',
          margin: '2rem 0'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '28px',
            padding: '2.5rem',
            boxShadow: '0 4px 24px rgba(16, 185, 129, 0.02)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <span style={{
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#059669',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                ♻️ Smart Food Rescue Preview
              </span>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.25rem',
                fontWeight: 800,
                color: '#0f172a',
                marginTop: '0.6rem',
                marginBottom: '0.6rem'
              }}>
                Save Food. Save Money. Reduce Waste.
              </h2>
              <p style={{
                color: '#475569',
                fontSize: '1rem',
                maxWidth: '650px',
                margin: '0 auto',
                lineHeight: '1.6'
              }}>
                SmartEats identifies eligible surplus food and makes suitable time-sensitive rescue offers available to customers and other authorized participants.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {sampleRescueOffers.map((offer) => (
                <RescueCard 
                  key={offer.id} 
                  offer={offer} 
                  onViewOffer={handleViewOffer}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.85rem 2rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
                }}
              >
                Claim Surplus Rescue Offers
              </button>
            </div>
          </div>
        </section>

        {/* How SmartEats Works (Visual Workflows) */}
        <Workflow />

        {/* Role Modules Workspaces */}
        <RoleSections />

        {/* About SmartEats Concept */}
        <section id="about" style={{
          padding: '4rem 0',
          borderTop: '1px solid #e2e8f0',
          marginTop: '2rem'
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '2.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
          }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2rem',
              fontWeight: 800,
              color: '#0f172a',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              About SmartEats Platform
            </h2>
            <p style={{
              color: '#475569',
              fontSize: '1.05rem',
              lineHeight: '1.7',
              textAlign: 'center',
              maxWidth: '850px',
              margin: '0 auto 2rem auto'
            }}>
              SmartEats is not only a food ordering platform. It is a distributed software solution designed to optimize the food logistics cycle while preventing edible prepared food from going into waste bins. By coordinating actors, forecasting kitchen demand, and matching surplus meals, we construct an intelligent and sustainable food delivery ecosystem.
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              {[
                "Food Delivery",
                "Intelligent Decision Support",
                "Demand Forecasting",
                "Delivery Optimization",
                "Food Waste Reduction",
                "Food Rescue"
              ].map((pill) => (
                <span
                  key={pill}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    padding: '8px 16px',
                    borderRadius: '30px',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Placeholder Section */}
        <section id="contact" style={{ padding: '3rem 0', textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            Have questions about SmartEats?
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Reach out to our project coordinating desk at support@smarteats.com
          </p>
          <a
            href="mailto:support@smarteats.com"
            style={{
              display: 'inline-block',
              background: '#0f172a',
              color: 'white',
              textDecoration: 'none',
              padding: '0.7rem 1.8rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.88rem'
            }}
          >
            Email Support
          </a>
        </section>

      </div>

      {/* Offer Details Modal */}
      {selectedOffer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '24px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setSelectedOffer(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#f1f5f9',
                border: 'none',
                color: '#475569',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <span style={{
              background: '#10b981',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '20px',
              textTransform: 'uppercase'
            }}>
              {selectedOffer.discountPct}% OFF Deal
            </span>

            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#0f172a',
              marginTop: '1rem',
              marginBottom: '0.25rem'
            }}>
              {selectedOffer.name}
            </h3>
            <p style={{ color: '#059669', fontSize: '0.88rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Prepared by {selectedOffer.restaurant}
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.88rem',
              color: '#475569',
              lineHeight: '1.5',
              marginBottom: '1.5rem'
            }}>
              <strong>Surplus Reason:</strong> {selectedOffer.description}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Original Price</div>
                <div style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '1rem' }}>
                  ₹{selectedOffer.originalPrice}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Rescue Deal Price</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
                  ₹{selectedOffer.rescuePrice}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                onClick={handleTryPurchase}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Claim This Rescue Offer
              </button>
              <button
                onClick={() => setSelectedOffer(null)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Required Warning Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            border: '2px solid #f59e0b',
            borderRadius: '24px',
            padding: '2rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowLoginModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#f1f5f9',
                border: 'none',
                color: '#475569',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#d97706',
              marginBottom: '0.5rem'
            }}>
              Login Required
            </h3>
            <p style={{
              color: '#475569',
              fontSize: '0.9rem',
              lineHeight: '1.5',
              marginBottom: '2rem'
            }}>
              Please login as a customer to purchase a Smart Food Rescue offer.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link
                to="/login"
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #ff5e3a 0%, #f97316 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.8rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'block'
                }}
              >
                Login
              </Link>
              <Link
                to="/register"
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  color: '#475569',
                  textDecoration: 'none',
                  padding: '0.8rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'block',
                  border: '1px solid #cbd5e1'
                }}
              >
                Register
              </Link>
            </div>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                marginTop: '1.25rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                textDecoration: 'underline'
              }}
            >
              Close and Browse
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
