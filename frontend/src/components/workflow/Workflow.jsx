import React from 'react';

export default function Workflow() {
  return (
    <section id="how-it-works" style={{ padding: '4rem 0', fontFamily: 'var(--font-body)' }}>
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.25rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '0.75rem'
        }}>
          How SmartEats Operates
        </h2>
        <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          Explore our dual-pipeline architecture optimization for standard delivery and zero-waste recovery.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
        
        {/* Normal Workflow */}
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.3rem',
            fontWeight: 800,
            color: '#1e293b',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.6rem' }}>🚴</span> Standard Intelligent Delivery Loop
          </h3>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }} className="flow-container">
            
            {/* Step 1 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>1. Customer Orders</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Places order via app, matched using taste preferences.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#cbd5e1', transform: 'rotate(0deg)' }} className="arrow-flow">➔</div>

            {/* Step 2 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>2. Restaurant Prepares</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Accepts order, updates preparation status in real-time.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#cbd5e1' }} className="arrow-flow">➔</div>

            {/* Step 3 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛵</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>3. Smart Assignment</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Rider assigned via Haversine proximity & load matching.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#cbd5e1' }} className="arrow-flow">➔</div>

            {/* Step 4 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😋</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>4. Customer Receives</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Order delivered warm with precise real-time ETA tracking.</p>
            </div>

          </div>
        </div>

        {/* Sustainability Workflow */}
        <div style={{
          background: 'white',
          border: '2px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.02)'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.3rem',
            fontWeight: 800,
            color: '#10b981',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.6rem' }}>♻️</span> Zero-Waste Sustainability Pipeline
          </h3>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }} className="flow-container">
            
            {/* Step 1 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>1. Surplus Prep Detected</h4>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>Cancelled order or extra prep identified in kitchen.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#a7f3d0' }} className="arrow-flow">➔</div>

            {/* Step 2 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>2. Surplus Trigger</h4>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>System automatically categorizes food & flags it as rescue item.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#a7f3d0' }} className="arrow-flow">➔</div>

            {/* Step 3 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>♻️</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>3. Food Rescue Match</h4>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>Dynamic time-sensitive offers generated at 35%-50% discount.</p>
            </div>

            <div style={{ fontSize: '1.5rem', color: '#a7f3d0' }} className="arrow-flow">➔</div>

            {/* Step 4 */}
            <div style={{ flex: '1 1 200px', textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤝</div>
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>4. Customer / NGO</h4>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>Claimed by local customers or dispatched to NGOs for community distribution.</p>
            </div>

          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .arrow-flow {
            transform: rotate(90deg) !important;
            margin: 0.5rem auto !important;
          }
          .flow-container {
            flex-direction: column !important;
          }
        }
      `}} />
    </section>
  );
}
