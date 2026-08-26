import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function RestaurantRdssDashboard() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
          datasets: [{
            label: 'Predicted Orders (Meals)',
            data: [15, 30, 85, 60, 25, 95, 110, 45],
            borderColor: '#00f2fe',
            backgroundColor: 'rgba(0, 242, 254, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3
          }, {
            label: 'Actual Orders',
            data: [18, 28, 90, 55, 20, 100, null, null],
            borderColor: '#ff5e3a',
            borderDash: [5, 5],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem' }}>Restaurant Decision Support System (RDSS)</h1>
        <p style={{ color: 'var(--text-sub)' }}>AI-powered demand forecasting, dynamic pricing, and sustainable food waste mitigation.</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Tomorrow's Forecasted Orders</div>
          <div className="metric-val" style={{ color: 'var(--accent-cyan)' }}>420 Meals</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '4px' }}>▲ 14% vs avg weekday</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Predicted Food Surplus</div>
          <div className="metric-val" style={{ color: '#f59e0b' }}>18 Portions</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>Flagged for auto-discounting</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Food Waste Prevented</div>
          <div className="metric-val" style={{ color: 'var(--accent-green)' }}>142.5 kg</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '4px' }}>This Month</div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>NGO Donations Dispatched</div>
          <div className="metric-val" style={{ color: '#a855f7' }}>45 Meals</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px' }}>Robin Hood Army Partner</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>📈 AI Demand Forecast Model (Next 24 Hours)</h3>
          <canvas ref={chartRef} height="140"></canvas>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>♻️ Surplus Mitigation Controls</h3>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Woodfired Margherita Surplus</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.8rem' }}>8 items remaining. Predicted end-of-day surplus.</div>
            <button
              style={{ background: 'var(--accent-gradient)', border: 'none', color: '#000', fontWeight: 700, padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
              onClick={() => alert('Dynamic 35% discount triggered for Woodfired Margherita! Price reduced to ₹292 on Customer Storefront.')}
            >
              Trigger Dynamic 35% Discount
            </button>
          </div>

          <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: '4px' }}>NGO Dispatch Routing</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '0.8rem' }}>Automatically dispatch remaining surplus to local food banks at 10 PM.</div>
            <button
              style={{ background: '#a855f7', border: 'none', color: '#fff', fontWeight: 700, padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
              onClick={() => alert('Dispatched surplus meals to NGO partner (Robin Hood Army)! Notification sent.')}
            >
              Dispatch to NGO Partner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
