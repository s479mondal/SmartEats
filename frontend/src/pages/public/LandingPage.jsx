import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <div className="hero-banner" style={{ padding: '4.5rem 3rem' }}>
        <div style={{ maxWidth: '680px' }}>
          <span className="badge badge-ai" style={{ marginBottom: '1rem' }}>⚡ SMART EATS</span>
          <h1 className="hero-title" style={{ fontSize: '3rem', lineHeight: '1.15' }}>
            Intelligent Food Delivery. Less Waste.
          </h1>
          <p className="hero-subtitle" style={{ fontSize: '1.1rem', margin: '1rem 0 2rem 0', lineHeight: '1.6' }}>
            SmartEats connects Customers, Restaurants, Delivery Partners, NGOs, and Administrators into one unified intelligent ecosystem powered by Apache Kafka & RDSS AI.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn-action" style={{ display: 'inline-block', width: 'auto', padding: '0.9rem 2rem', textDecoration: 'none' }}>
              Get Started Now
            </Link>
            <a href="#food-rescue-info" className="cat-btn" style={{ padding: '0.9rem 1.8rem', fontSize: '1rem', textDecoration: 'none' }}>
              How Food Rescue Works ➔
            </a>
          </div>
        </div>
        <div style={{ fontSize: '7rem' }}>🍔♻️</div>
      </div>

      {/* Why SmartEats Section */}
      <div style={{ margin: '4rem 0' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', textAlign: 'center', marginBottom: '2rem', fontSize: '2rem' }}>Why SmartEats?</h2>
        <div className="grid-3">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🍴</div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Smart Food Delivery</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.4rem' }}>Seamless multi-restaurant discovery and real-time Kafka order updates.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤖</div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Intelligent Recommendations</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.4rem' }}>Preference-aware algorithms that suggest meals tailored to your taste.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚴</div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Smart Delivery & ETA</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.4rem' }}>Haversine proximity algorithms to pair nearby active riders.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>♻️</div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Food Rescue Ecosystem</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.4rem' }}>Role-based surplus recovery connecting kitchens, customers, and NGOs.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Demand Forecasting</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginTop: '0.4rem' }}>Random Forest AI models predicting 24-hour kitchen prep demand.</p>
          </div>
        </div>
      </div>

      {/* PUBLIC FOOD RESCUE INTRODUCTION & MARKETING SECTION */}
      <div id="food-rescue-info" style={{ margin: '4rem 0', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '3rem 2.5rem', borderRadius: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 2.5rem auto' }}>
          <span className="badge badge-surplus" style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>♻️ Smart Food Rescue Initiative</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', lineHeight: '1.2' }}>Save Good Food. Save Money. Eliminate Waste.</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '1.05rem', marginTop: '0.8rem', lineHeight: '1.6' }}>
            Our dynamic surplus recovery engine continuously monitors kitchen inventory, applies AI-driven time-sensitive discounts, and matches surplus meals with nearby customers and community food partners.
          </p>
        </div>

        {/* Role-Based Workflow Diagram */}
        <h3 style={{ fontFamily: 'var(--font-heading)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.3rem', color: 'var(--accent-green)' }}>
          Role-Based Food Rescue Workflow
        </h3>

        <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
          <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.3)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🛒</div>
            <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)' }}>For Customers</h4>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>
              Access exclusive <strong>35% to 50% OFF</strong> rescue deals tailored to your location and dietary preferences.
            </p>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 700 }}>Action: Purchase Rescue Offer</span>
          </div>

          <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🏪</div>
            <h4 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b' }}>For Restaurants</h4>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>
              Instantly list surplus meals, automate discount schedules, and convert unsold inventory into recovered revenue.
            </p>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>Action: Create & Manage Offer</span>
          </div>

          <div className="card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🤝</div>
            <h4 style={{ fontFamily: 'var(--font-heading)', color: '#a855f7' }}>For NGOs</h4>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>
              Receive instant alerts for unallocated prepared meals and schedule community food collection pickups.
            </p>
            <span style={{ fontSize: '0.8rem', color: '#a855f7', fontWeight: 700 }}>Action: Collect & Feed Community</span>
          </div>
        </div>

        {/* Call-to-Action Box */}
        <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '16px', border: '1px dashed rgba(16, 185, 129, 0.4)' }}>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            Ready to participate in Smart Food Rescue?
          </h4>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
            Login or register with your specific role to access your dedicated Food Rescue workspace.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn-action" style={{ display: 'inline-block', width: 'auto', textDecoration: 'none', padding: '0.7rem 1.8rem' }}>
              Sign In to Access
            </Link>
            <Link to="/register" className="cat-btn" style={{ textDecoration: 'none', padding: '0.7rem 1.8rem' }}>
              Create an Account
            </Link>
          </div>
        </div>
      </div>

      {/* How SmartEats Works Workflow */}
      <div style={{ margin: '4rem 0', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>How SmartEats Works</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '1.5rem 2rem' }}>🛒 Customer Places Order</div>
          <div style={{ fontSize: '1.5rem', color: 'var(--accent-cyan)' }}>➔</div>
          <div className="card" style={{ padding: '1.5rem 2rem' }}>🏪 Restaurant Prepares Food</div>
          <div style={{ fontSize: '1.5rem', color: 'var(--accent-cyan)' }}>➔</div>
          <div className="card" style={{ padding: '1.5rem 2rem' }}>🛵 Delivery Partner Delivers</div>
        </div>
        <div style={{ marginTop: '1rem', fontSize: '1.2rem', color: 'var(--accent-green)' }}>
          ↓ (Surplus Detected / Order Cancelled)
        </div>
        <div style={{ display: 'inline-block', marginTop: '0.5rem' }} className="card">
          ♻️ Smart Food Rescue (Discounted Customer Purchase OR NGO Community Dispatch)
        </div>
      </div>

      {/* Role Cards (For Restaurants, Drivers, NGOs) */}
      <div className="grid-3" style={{ margin: '4rem 0' }}>
        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
          <h3 style={{ fontFamily: 'var(--font-heading)' }}>For Restaurants</h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0' }}>Manage orders, forecast demand with AI, and reduce food waste.</p>
          <Link to="/register" className="btn-action" style={{ display: 'inline-block', width: 'auto', textDecoration: 'none', padding: '0.6rem 1.2rem' }}>Join as Restaurant</Link>
        </div>

        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛵</div>
          <h3 style={{ fontFamily: 'var(--font-heading)' }}>For Delivery Partners</h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0' }}>Flexible delivery, intelligent proximity matching, and high earnings.</p>
          <Link to="/register" className="btn-action" style={{ display: 'inline-block', width: 'auto', textDecoration: 'none', padding: '0.6rem 1.2rem' }}>Join as Delivery Partner</Link>
        </div>

        <div className="card">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤝</div>
          <h3 style={{ fontFamily: 'var(--font-heading)' }}>For NGOs</h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', margin: '0.5rem 0' }}>Participate in food rescue, manage pickups, and track community impact.</p>
          <Link to="/register" className="btn-action" style={{ display: 'inline-block', width: 'auto', textDecoration: 'none', padding: '0.6rem 1.2rem' }}>Join as NGO</Link>
        </div>
      </div>
    </div>
  );
}
