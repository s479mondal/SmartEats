import React from 'react';
import { Link } from 'react-router-dom';

export default function RoleSections() {
  const roles = [
    {
      title: "For Customers",
      icon: "🛒",
      color: "#ff5e3a",
      features: [
        "Discover nearby restaurants and local cuisines",
        "Browse curated menus with real-time pricing",
        "Personalized food recommendations matching tastes",
        "Place secure orders instantly in Indian Rupees (₹)",
        "Track delivery step-by-step with real-time ETA",
        "Claim time-sensitive surplus Food Rescue offers"
      ],
      btnLabel: "Start Ordering",
      btnLink: "/register"
    },
    {
      title: "For Restaurant Owners",
      icon: "🏪",
      color: "#3b82f6",
      features: [
        "Manage restaurant profile and address details",
        "Complete Menu CRUD with pricing control",
        "Receive and process customer orders dynamically",
        "Leverage 24-hour Random Forest demand forecasts",
        "Improve daily kitchen preparation planning",
        "Flag prepared surplus and configure rescue discounts"
      ],
      btnLabel: "Join as Restaurant",
      btnLink: "/register",
      note: "Requires administrator approval after registration"
    },
    {
      title: "For Delivery Partners",
      icon: "🚴",
      color: "#f59e0b",
      features: [
        "Manage active delivery availability status",
        "Receive smart geographic assignments",
        "View step-by-step route directions",
        "Update pickup, transit, and delivery milestones",
        "Proximity-based dispatch matching algorithms",
        "Assist in zero-waste rescue dispatch pickups"
      ],
      btnLabel: "Join as Delivery Partner",
      btnLink: "/register",
      note: "Requires administrator approval after registration"
    },
    {
      title: "For NGOs",
      icon: "🤝",
      color: "#10b981",
      features: [
        "Register to receive alerts for unallocated surplus meals",
        "Scan local maps for eligible food rescue opportunities",
        "Reserve and dispatch volunteers for meal pickups",
        "Track meals collected and distributed over time",
        "Access detailed dashboard on sustainability metrics"
      ],
      btnLabel: "Join as NGO",
      btnLink: "/register",
      note: "Requires administrator approval after registration"
    }
  ];

  return (
    <section id="roles" style={{ padding: '4rem 0', fontFamily: 'var(--font-body)' }}>
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '2.25rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '0.75rem'
        }}>
          Ecosystem Role Workspaces
        </h2>
        <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          SmartEats is a collaborative platform supporting customized, security-protected portals for all ecosystem actors.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '2rem'
      }}>
        {roles.map((role) => (
          <div
            key={role.title}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '2rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.3s ease, border-color 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = role.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '1.5rem'
              }}>
                <span style={{ fontSize: '2rem' }}>{role.icon}</span>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#0f172a'
                }}>
                  {role.title}
                </h3>
              </div>

              <ul style={{
                paddingLeft: '1.2rem',
                color: '#475569',
                fontSize: '0.88rem',
                lineHeight: '1.6',
                marginBottom: '2rem',
                listStyleType: 'square'
              }}>
                {role.features.map((feat, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{feat}</li>
                ))}
              </ul>
            </div>

            <div>
              <Link
                to={role.btnLink}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: role.color,
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.8rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: `0 4px 14px ${role.color}25`,
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                {role.btnLabel}
              </Link>
              {role.note && (
                <p style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  ⚠️ {role.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
