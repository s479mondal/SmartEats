import React, { useState } from 'react';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('smarteats_preferences');
      return saved ? JSON.parse(saved) : ['Paneer', 'North Indian', 'Healthy', 'Spicy'];
    } catch {
      return ['Paneer', 'North Indian', 'Healthy', 'Spicy'];
    }
  });
  const [msg, setMsg] = useState('');

  const availableTags = [
    'Vegetarian', 'Non-Vegetarian', 'Paneer', 'Biryani', 'South Indian', 
    'North Indian', 'Healthy', 'Spicy', 'Italian', 'Burgers', 'Desserts'
  ];

  const togglePreference = (tag) => {
    if (preferences.includes(tag)) {
      setPreferences(preferences.filter((t) => t !== tag));
    } else {
      setPreferences([...preferences, tag]);
    }
  };

  const handleSave = () => {
    localStorage.setItem('smarteats_preferences', JSON.stringify(preferences));
    setMsg('✅ Food preferences saved! Personalized recommendation engine updated.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="card" style={{ borderColor: 'rgba(0, 242, 254, 0.4)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>Customer Food Preferences</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Select your dietary preferences to personalize AI-driven recommendation rankings and surplus deal alerts.
        </p>

        {msg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--accent-green)', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.2rem', textAlign: 'center' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {availableTags.map((tag) => {
            const isSelected = preferences.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => togglePreference(tag)}
                style={{
                  background: isSelected ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.05)',
                  border: isSelected ? 'none' : '1px solid var(--bg-card-border)',
                  color: isSelected ? '#fff' : 'var(--text-sub)',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {isSelected ? `✓ ${tag}` : `+ ${tag}`}
              </button>
            );
          })}
        </div>

        <button className="btn-action" onClick={handleSave}>
          Save Food Preferences
        </button>
      </div>
    </div>
  );
}
