import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/orderApi';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('RESTAURANTS');
  const [restaurants, setRestaurants] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchApprovals = () => {
    setLoading(true);
    adminApi.getPendingApprovals()
      .then((res) => {
        const data = res?.data || res || {};
        setRestaurants(data.restaurants || []);
        setDrivers(data.deliveryPartners || data.drivers || []);
        setNgos(data.ngos || []);
      })
      .catch((err) => {
        setError('Failed to fetch pending applications from API Gateway.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (id, type) => {
    try {
      await adminApi.updateApprovalStatus(type.toLowerCase(), id, 'APPROVED');
      alert(`Approved ${type} account ID ${id}! API Gateway status updated.`);
      fetchApprovals();
    } catch (err) {
      alert('Failed to approve account: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReject = async (id, type) => {
    try {
      await adminApi.updateApprovalStatus(type.toLowerCase(), id, 'REJECTED');
      alert(`Rejected ${type} account ID ${id}. API Gateway status updated.`);
      fetchApprovals();
    } catch (err) {
      alert('Failed to reject account: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="badge badge-ai" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.4)' }}>
            🛡️ Platform Administrator Command Center
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginTop: '0.4rem' }}>Platform Oversight & Verification Queue</h1>
          <p style={{ color: 'var(--text-sub)' }}>Manage account approvals, system users, order tracking, and ecosystem food rescue analytics.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Admin System High Level Metrics */}
      <div className="metric-grid">
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Pending Account Approvals</div>
          <div className="metric-val" style={{ color: '#f59e0b' }}>
            {restaurants.filter(r => r.status === 'PENDING').length + drivers.filter(d => d.status === 'PENDING').length + ngos.filter(n => n.status === 'PENDING').length} Accounts
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Approved Restaurants</div>
          <div className="metric-val" style={{ color: 'var(--accent-green)' }}>
            {restaurants.filter(r => r.status === 'APPROVED').length} Kitchens
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Approved Drivers</div>
          <div className="metric-val" style={{ color: 'var(--accent-cyan)' }}>
            {drivers.filter(d => d.status === 'APPROVED').length} Riders
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Approved NGOs</div>
          <div className="metric-val" style={{ color: '#a855f7' }}>
            {ngos.filter(n => n.status === 'APPROVED').length} Partners
          </div>
        </div>
      </div>

      {/* Approval Queues Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`cat-btn ${activeTab === 'RESTAURANTS' ? 'active' : ''}`} onClick={() => setActiveTab('RESTAURANTS')}>
          🏪 Restaurant Applications ({restaurants.filter(r => r.status === 'PENDING').length} Pending)
        </button>
        <button className={`cat-btn ${activeTab === 'DRIVERS' ? 'active' : ''}`} onClick={() => setActiveTab('DRIVERS')}>
          🛵 Delivery Partners ({drivers.filter(d => d.status === 'PENDING').length} Pending)
        </button>
        <button className={`cat-btn ${activeTab === 'NGOS' ? 'active' : ''}`} onClick={() => setActiveTab('NGOS')}>
          🤝 NGO Applications ({ngos.filter(n => n.status === 'PENDING').length} Pending)
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '2rem 0' }}>Loading verification queues from API Gateway...</div>
      ) : (
        <>
          {/* Restaurants Table */}
          {activeTab === 'RESTAURANTS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Restaurant Applications Queue</h3>
              {restaurants.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '1.5rem 0', textAlign: 'center' }}>No pending restaurant applications.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Restaurant Name</th>
                      <th style={{ padding: '0.8rem' }}>Owner</th>
                      <th style={{ padding: '0.8rem' }}>Cuisine</th>
                      <th style={{ padding: '0.8rem' }}>Contact</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem', fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: '0.8rem' }}>{item.owner || item.ownerEmail}</td>
                        <td style={{ padding: '0.8rem' }}>{item.cuisine || item.cuisineType}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.email || item.ownerEmail}<br />{item.phone}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: item.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : (item.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'), color: item.status === 'APPROVED' ? 'var(--accent-green)' : (item.status === 'REJECTED' ? '#ef4444' : '#f59e0b') }}>
                            {item.status || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          {item.status === 'PENDING' || !item.status ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleApprove(item.id || item._id, 'RESTAURANTS')} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                              <button onClick={() => handleReject(item.id || item._id, 'RESTAURANTS')} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-sub)' }}>Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Delivery Partners Table */}
          {activeTab === 'DRIVERS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Delivery Partner Verification Queue</h3>
              {drivers.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '1.5rem 0', textAlign: 'center' }}>No pending delivery partner applications.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Rider Name</th>
                      <th style={{ padding: '0.8rem' }}>Vehicle Type</th>
                      <th style={{ padding: '0.8rem' }}>Contact</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem', fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: '0.8rem' }}>{item.vehicle || 'Standard'}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.email}<br />{item.phone}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: item.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : (item.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'), color: item.status === 'APPROVED' ? 'var(--accent-green)' : (item.status === 'REJECTED' ? '#ef4444' : '#f59e0b') }}>
                            {item.status || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          {item.status === 'PENDING' || !item.status ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleApprove(item.id || item._id, 'DRIVERS')} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                              <button onClick={() => handleReject(item.id || item._id, 'DRIVERS')} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-sub)' }}>Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* NGO Table */}
          {activeTab === 'NGOS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>NGO Community Verification Queue</h3>
              {ngos.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '1.5rem 0', textAlign: 'center' }}>No pending NGO applications.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>NGO Name</th>
                      <th style={{ padding: '0.8rem' }}>Contact Person</th>
                      <th style={{ padding: '0.8rem' }}>Contact Details</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ngos.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem', fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: '0.8rem' }}>{item.contact || item.name}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.email}<br />{item.phone}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: item.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : (item.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'), color: item.status === 'APPROVED' ? 'var(--accent-green)' : (item.status === 'REJECTED' ? '#ef4444' : '#f59e0b') }}>
                            {item.status || 'PENDING'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          {item.status === 'PENDING' || !item.status ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleApprove(item.id || item._id, 'NGOS')} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                              <button onClick={() => handleReject(item.id || item._id, 'NGOS')} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-sub)' }}>Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
