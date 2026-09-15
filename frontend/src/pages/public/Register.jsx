import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const [selectedRole, setSelectedRole] = useState('CUSTOMER');
  
  // Section A: Owner / Common Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState('');

  // Customer Specific Fields
  const [foodPreferences, setFoodPreferences] = useState(['Vegetarian']);

  // Section B: Restaurant Information
  const [restaurantName, setRestaurantName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisineType, setCuisineType] = useState('Multi-Cuisine');
  const [restaurantContact, setRestaurantContact] = useState('');
  const [restaurantEmail, setRestaurantEmail] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [openingTime, setOpeningTime] = useState('10:00 AM');
  const [closingTime, setClosingTime] = useState('10:00 PM');
  const [logoUrl, setLogoUrl] = useState('');

  // Section C: Verification Information
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [foodLicenseNumber, setFoodLicenseNumber] = useState('');
  const [verificationDocumentUrl, setVerificationDocumentUrl] = useState('');

  // Delivery Partner Specific Fields
  const [vehicleType, setVehicleType] = useState('BIKE');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [verificationInfo, setVerificationInfo] = useState('');

  // NGO Specific Fields
  const [ngoName, setNgoName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [ngoAddress, setNgoAddress] = useState('');
  const [organizationInfo, setOrganizationInfo] = useState('');
  const [foodRescueInfo, setFoodRescueInfo] = useState('');

  // Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handlePreferenceToggle = (pref) => {
    if (foodPreferences.includes(pref)) {
      setFoodPreferences(foodPreferences.filter(p => p !== pref));
    } else {
      setFoodPreferences([...foodPreferences, pref]);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Password validation
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    setLoading(true);

    try {
      const backendRole = selectedRole === 'RESTAURANT' ? 'RESTAURANT_OWNER' : selectedRole;
      const payload = {
        name: selectedRole === 'NGO' ? contactPerson || name : name,
        email,
        phone,
        password,
        address: selectedRole === 'RESTAURANT' ? restaurantAddress || address : (selectedRole === 'NGO' ? ngoAddress || address : address),
        location: selectedRole === 'RESTAURANT' ? `${city}, ${pincode}` || location : location,
        roles: [backendRole],
        
        // Customer specific
        foodPreferences: selectedRole === 'CUSTOMER' ? foodPreferences : null,
        
        // Restaurant specific (Section B & C)
        restaurantName: selectedRole === 'RESTAURANT' ? restaurantName : null,
        description: selectedRole === 'RESTAURANT' ? description : null,
        restaurantAddress: selectedRole === 'RESTAURANT' ? restaurantAddress : null,
        restaurantLocation: selectedRole === 'RESTAURANT' ? `${city}, ${pincode}` : null,
        city: selectedRole === 'RESTAURANT' ? city : null,
        pincode: selectedRole === 'RESTAURANT' ? pincode : null,
        cuisineType: selectedRole === 'RESTAURANT' ? cuisineType : null,
        restaurantContact: selectedRole === 'RESTAURANT' ? restaurantContact || phone : null,
        restaurantEmail: selectedRole === 'RESTAURANT' ? restaurantEmail || email : null,
        openingTime: selectedRole === 'RESTAURANT' ? openingTime : null,
        closingTime: selectedRole === 'RESTAURANT' ? closingTime : null,
        logoUrl: selectedRole === 'RESTAURANT' ? logoUrl : null,
        businessRegistrationNumber: selectedRole === 'RESTAURANT' ? businessRegistrationNumber : null,
        foodLicenseNumber: selectedRole === 'RESTAURANT' ? foodLicenseNumber : null,
        verificationDocumentUrl: selectedRole === 'RESTAURANT' ? verificationDocumentUrl : null,

        // Delivery Partner specific
        vehicleType: selectedRole === 'DELIVERY_PARTNER' ? vehicleType : null,
        vehicleNumber: selectedRole === 'DELIVERY_PARTNER' ? vehicleNumber : null,
        verificationInfo: selectedRole === 'DELIVERY_PARTNER' ? verificationInfo : null,
        
        // NGO specific
        ngoName: selectedRole === 'NGO' ? ngoName : null,
        contactPerson: selectedRole === 'NGO' ? contactPerson || name : null,
        ngoAddress: selectedRole === 'NGO' ? ngoAddress : null,
        organizationInfo: selectedRole === 'NGO' ? organizationInfo : null,
        foodRescueInfo: selectedRole === 'NGO' ? foodRescueInfo : null
      };

      const userObj = await register(payload);

      if (userObj.status === 'ACTIVE' || userObj.approved) {
        navigate('/customer/dashboard');
      } else {
        navigate('/application-pending');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please verify your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const roleCards = [
    {
      id: 'CUSTOMER',
      icon: '🛒',
      title: 'Customer',
      tag: 'Instant Activation',
      tagColor: 'var(--accent-green)',
      desc: 'Order delicious meals, track deliveries with AI ETAs, and rescue surplus food.'
    },
    {
      id: 'RESTAURANT',
      icon: '🏪',
      title: 'Restaurant Owner',
      tag: 'Admin Approval Required',
      tagColor: '#f59e0b',
      desc: 'Register kitchen profile & credentials. Configure your live menu after Admin approval.'
    },
    {
      id: 'DELIVERY_PARTNER',
      icon: '🛵',
      title: 'Delivery Partner',
      tag: 'Admin Verification Required',
      tagColor: '#00f2fe',
      desc: 'Earn with dynamic route optimization, instant dispatch assignments, and flexible hours.'
    },
    {
      id: 'NGO',
      icon: '🤝',
      title: 'NGO Partner',
      tag: 'Admin Verification Required',
      tagColor: '#a855f7',
      desc: 'Participate in Smart Food Rescue, collect surplus meals from restaurants, and feed communities.'
    }
  ];

  return (
    <div className="container" style={{ maxWidth: '840px', marginTop: '2.5rem', marginBottom: '4rem' }}>
      <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.3)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="badge badge-ai" style={{ marginBottom: '0.5rem' }}>🌱 Join the SmartEats Ecosystem</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginTop: '0.3rem' }}>Create Your SmartEats Account</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
            Select your ecosystem role below to display your customized registration application.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '0.9rem', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step 1: Account Type Cards */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.8rem' }}>
            STEP 1: SELECT ACCOUNT TYPE
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
            {roleCards.map((rc) => {
              const isSelected = selectedRole === rc.id;
              return (
                <div
                  key={rc.id}
                  onClick={() => setSelectedRole(rc.id)}
                  style={{
                    background: isSelected ? 'rgba(0, 242, 254, 0.08)' : '#1e293b',
                    border: `2px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--bg-card-border)'}`,
                    borderRadius: '14px',
                    padding: '1.1rem 0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{rc.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#fff' : '#e2e8f0', marginBottom: '0.3rem' }}>
                      {rc.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', lineHeight: '1.4', marginBottom: '0.8rem' }}>
                      {rc.desc}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: rc.tagColor, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '8px', border: `1px solid ${rc.tagColor}40` }}>
                      {rc.tag}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informational Alert for Roles Requiring Admin Approval */}
        {selectedRole !== 'CUSTOMER' && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.9rem 1.2rem', borderRadius: '12px', marginBottom: '1.8rem', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <strong>Admin Verification Workflow:</strong> Upon registration, your application status will be marked as <strong>PENDING</strong>. An Administrator will review your credentials before operational access is unlocked.
            </div>
          </div>
        )}

        {/* Step 2: Dynamic Form Fields */}
        <form onSubmit={handleRegister}>
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>

            {/* CUSTOMER FORM */}
            {selectedRole === 'CUSTOMER' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: CUSTOMER DETAILS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Full Name *</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Delivery Address / Location *</label>
                    <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="100ft Road, Indiranagar, Bengaluru" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '6px' }}>Food Dietary Preferences (Select tags)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Vegetarian', 'Non-Veg', 'Vegan', 'Halal', 'Gluten-Free', 'Organic', 'Jain', 'High Protein'].map((pref) => {
                      const active = foodPreferences.includes(pref);
                      return (
                        <button
                          type="button"
                          key={pref}
                          onClick={() => handlePreferenceToggle(pref)}
                          style={{
                            background: active ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                            border: `1px solid ${active ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)'}`,
                            color: active ? 'var(--accent-green)' : 'var(--text-sub)',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: active ? 700 : 500
                          }}
                        >
                          {active ? '✓ ' : '+ '} {pref}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* RESTAURANT OWNER FORM (Structured into Section A, B, and C) */}
            {selectedRole === 'RESTAURANT' && (
              <>
                {/* SECTION A */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    👤 Section A: Owner Account Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Full Name *</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Email Address *</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@gmail.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Owner Phone Number *</label>
                      <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION B */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: '#f59e0b', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏪 Section B: Restaurant Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Name *</label>
                      <input type="text" required value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="Spice Hub" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Cuisine / Food Category *</label>
                      <input type="text" required value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} placeholder="Indian / Tandoor / Biryani" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Contact Phone</label>
                      <input type="tel" value={restaurantContact} onChange={(e) => setRestaurantContact(e.target.value)} placeholder="9876543210" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Restaurant Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Authentic North Indian curries and gourmet tandoor dishes." style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px', minHeight: '60px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Physical Address *</label>
                      <input type="text" required value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} placeholder="Katpadi Main Road" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>City *</label>
                      <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Vellore" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Pincode *</label>
                      <input type="text" required value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="632007" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Opening Time</label>
                      <input type="text" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} placeholder="10:00 AM" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Closing Time</label>
                      <input type="text" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} placeholder="10:00 PM" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Logo / Image URL</label>
                      <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                </div>

                {/* SECTION C */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📑 Section C: Verification Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Business Registration Number *</label>
                      <input type="text" required value={businessRegistrationNumber} onChange={(e) => setBusinessRegistrationNumber(e.target.value)} placeholder="REG-TN-2023-889977" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Food / FSSAI License Number *</label>
                      <input type="text" required value={foodLicenseNumber} onChange={(e) => setFoodLicenseNumber(e.target.value)} placeholder="FSSAI-11223344556677" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Verification Document Summary / Notes</label>
                    <input type="text" value={verificationDocumentUrl} onChange={(e) => setVerificationDocumentUrl(e.target.value)} placeholder="Authorized municipal trade license & FSSAI certificate on file" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.75rem', borderRadius: '8px' }} />
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', background: 'rgba(0, 242, 254, 0.05)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.2)', marginBottom: '1.2rem' }}>
                  ℹ️ <strong>Note:</strong> Menu items are configured directly from your Restaurant Dashboard after Admin approval.
                </div>
              </>
            )}

            {/* DELIVERY PARTNER FORM */}
            {selectedRole === 'DELIVERY_PARTNER' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: DELIVERY PARTNER DETAILS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rider Full Name *</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Suresh Kumar" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="driver@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 99887 76655" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Residential Address *</label>
                    <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Koramangala 4th Block, Bengaluru" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Vehicle Type *</label>
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }}>
                      <option value="BIKE">🏍️ Motorbike</option>
                      <option value="SCOOTER">🛵 Scooter</option>
                      <option value="ELECTRIC_VEHICLE">⚡ Electric Vehicle (EV)</option>
                      <option value="BICYCLE">🚲 Eco Bicycle</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Vehicle License Plate Number *</label>
                    <input type="text" required value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA-01-AB-1234" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Driving License / National ID Verification Number *</label>
                  <input type="text" required value={verificationInfo} onChange={(e) => setVerificationInfo(e.target.value)} placeholder="DL-KA-2023-99887711" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                </div>
              </>
            )}

            {/* NGO FORM */}
            {selectedRole === 'NGO' && (
              <>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                  STEP 2: NGO PARTNER DETAILS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>NGO Organization Name *</label>
                    <input type="text" required value={ngoName} onChange={(e) => setNgoName(e.target.value)} placeholder="Robin Hood Army Foundation" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Primary Contact Person *</label>
                    <input type="text" required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Priya Sharma" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Official Email Address *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ngo@smarteats.com" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Contact Phone Number *</label>
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 80 8899 0011" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>NGO Operational Address *</label>
                    <input type="text" required value={ngoAddress} onChange={(e) => setNgoAddress(e.target.value)} placeholder="12 Mission Road, Shanthi Nagar, Bengaluru" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Organization Type / Mission *</label>
                    <input type="text" required value={organizationInfo} onChange={(e) => setOrganizationInfo(e.target.value)} placeholder="Community Food Bank & Zero Waste Shelter" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Food Rescue & Distribution Capacity *</label>
                  <input type="text" required value={foodRescueInfo} onChange={(e) => setFoodRescueInfo(e.target.value)} placeholder="Capacity for 200+ surplus meals daily, cold chain van available" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
                </div>
              </>
            )}

            {/* Passwords (Common to all) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.2rem', marginBottom: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Create Password *</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Confirm Password *</label>
                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px' }} />
              </div>
            </div>

            <button type="submit" className="btn-action" disabled={loading} style={{ height: '48px', fontSize: '1rem' }}>
              {loading ? 'Submitting Registration Application...' : `Register as ${roleCards.find(r => r.id === selectedRole)?.title}`}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Sign In</Link>
        </p>

      </div>
    </div>
  );
}
