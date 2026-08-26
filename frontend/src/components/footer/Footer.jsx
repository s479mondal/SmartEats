import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      background: '#0f172a',
      color: '#cbd5e1',
      padding: '4rem 2rem 2rem 2rem',
      marginTop: '4rem',
      fontFamily: 'var(--font-body)',
      borderTop: '1px solid rgba(255,255,255,0.05)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '2.5rem',
        marginBottom: '3rem'
      }}>
        {/* Brand Col */}
        <div style={{ gridColumn: 'span 2' }} className="footer-brand-col">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'white',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.4rem',
            marginBottom: '1rem'
          }}>
            <span style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem'
            }}>
              ⚡
            </span>
            <span>Smart<span style={{ color: '#10b981' }}>Eats</span></span>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '300px' }}>
            Distributed intelligent food delivery platform aiming to maximize logistics efficiency and eliminate food waste.
          </p>
          
          {/* Social placeholder icons */}
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem' }}>
            {['🔗 Twitter', '🔗 LinkedIn', '🔗 GitHub'].map((social) => (
              <a
                key={social}
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontWeight: 600
                }}
              >
                {social}
              </a>
            ))}
          </div>
        </div>

        {/* Links Col 1 */}
        <div>
          <h4 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.2rem' }}>
            SmartEats
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
            <li><a href="#home" style={{ color: '#94a3b8', textDecoration: 'none' }}>About Us</a></li>
            <li><a href="#contact" style={{ color: '#94a3b8', textDecoration: 'none' }}>Contact</a></li>
            <li><a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a></li>
            <li><a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms of Service</a></li>
          </ul>
        </div>

        {/* Links Col 2 */}
        <div>
          <h4 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.2rem' }}>
            Portals
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
            <li><a href="#roles" style={{ color: '#94a3b8', textDecoration: 'none' }}>For Customers</a></li>
            <li><a href="#roles" style={{ color: '#94a3b8', textDecoration: 'none' }}>For Restaurants</a></li>
            <li><a href="#roles" style={{ color: '#94a3b8', textDecoration: 'none' }}>For Riders</a></li>
            <li><a href="#roles" style={{ color: '#94a3b8', textDecoration: 'none' }}>For NGOs</a></li>
          </ul>
        </div>

        {/* Links Col 3 */}
        <div>
          <h4 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.2rem' }}>
            Features
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
            <li><a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Food Delivery</a></li>
            <li><a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Demand Forecasting</a></li>
            <li><a href="#rescue" style={{ color: '#94a3b8', textDecoration: 'none' }}>Food Rescue</a></li>
            <li><a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Intelligent Delivery</a></li>
          </ul>
        </div>

      </div>

      {/* Copyright row */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        paddingTop: '2rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.82rem',
        color: '#64748b'
      }}>
        <span>© {currentYear} SmartEats. All rights reserved.</span>
        <span>MCA Capstone Project (Distributed System Simulation)</span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .footer-brand-col {
            grid-column: span 1 !important;
          }
        }
      `}} />
    </footer>
  );
}
