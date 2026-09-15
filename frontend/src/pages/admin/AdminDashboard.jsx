import React, { useState, useEffect } from 'react';
import { adminApi, restaurantOwnerApi } from '../../api/orderApi';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('PENDING_RESTAURANTS');
  const [restaurants, setRestaurants] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingRes, usersRes, crRes] = await Promise.all([
        adminApi.getPendingApprovals(),
        adminApi.getAllUsers('ALL'),
        restaurantOwnerApi.getPendingChangeRequests().catch(() => [])
      ]);

      const pData = pendingRes?.data || pendingRes || {};
      setRestaurants(pData.restaurants || []);
      setDrivers(pData.deliveryPartners || pData.drivers || []);
      setNgos(pData.ngos || []);

      const uData = usersRes?.data || usersRes || [];
      setAllUsers(Array.isArray(uData) ? uData : []);

      setChangeRequests(Array.isArray(crRes) ? crRes : []);
    } catch (err) {
      setError('Failed to fetch approval queues and users from API Gateway.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApprove = async (item, type) => {
    setActionLoading(true);
    try {
      await adminApi.updateApprovalStatus(type.toLowerCase(), item.id || item._id, 'ACTIVE');
      setSuccessMsg(`✅ Successfully approved ${item.name || item.restaurantName || 'account'}! Status set to ACTIVE.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to approve account: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (item, type) => {
    setRejectingItem({ ...item, entityType: type });
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    setActionLoading(true);
    try {
      await adminApi.updateApprovalStatus(
        rejectingItem.entityType.toLowerCase(),
        rejectingItem.id || rejectingItem._id,
        'REJECTED',
        rejectionReason || 'Application criteria not satisfied'
      );
      setSuccessMsg(`❌ Rejected application for ${rejectingItem.name || rejectingItem.restaurantName}. Reason saved.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setRejectingItem(null);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to reject application: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveChangeRequest = async (reqId) => {
    setActionLoading(true);
    try {
      await restaurantOwnerApi.approveChangeRequest(reqId);
      setSuccessMsg(`✅ Profile change request #${reqId.substring(0, 8)} approved and applied!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to approve change request: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectChangeRequest = async (reqId) => {
    const reason = prompt('Please enter reason for rejecting this profile change:');
    if (reason === null) return;
    setActionLoading(true);
    try {
      await restaurantOwnerApi.rejectChangeRequest(reqId, reason || 'Changes not authorized');
      setSuccessMsg(`❌ Profile change request #${reqId.substring(0, 8)} rejected.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to reject change request: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (item) => {
    if (!window.confirm(`Are you sure you want to SUSPEND the account for ${item.name} (${item.email})?`)) return;
    setActionLoading(true);
    try {
      await adminApi.updateApprovalStatus('users', item.id || item._id, 'SUSPENDED');
      setSuccessMsg(`⏸️ Suspended account for ${item.name}. Operational access is now blocked.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to suspend account: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (item) => {
    setActionLoading(true);
    try {
      await adminApi.updateApprovalStatus('users', item.id || item._id, 'ACTIVE');
      setSuccessMsg(`✅ Reactivated account for ${item.name}! Status restored to ACTIVE.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchDashboardData();
    } catch (err) {
      alert('Failed to reactivate account: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Filter queues
  const pendingRestaurants = restaurants.filter(r => r.status === 'PENDING' || r.status === 'PENDING_APPROVAL');
  const pendingDrivers = drivers.filter(d => d.status === 'PENDING' || d.status === 'PENDING_APPROVAL');
  const pendingNgos = ngos.filter(n => n.status === 'PENDING' || n.status === 'PENDING_APPROVAL');

  const activeUsers = allUsers.filter(u => u.status === 'ACTIVE' && !u.roles?.includes('ADMIN'));
  const rejectedUsers = allUsers.filter(u => u.status === 'REJECTED');
  const suspendedUsers = allUsers.filter(u => u.status === 'SUSPENDED');

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge badge-ai" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.4)' }}>
            🛡️ Platform Administrator Command Center
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginTop: '0.4rem' }}>Platform Oversight & Verification Queue</h1>
          <p style={{ color: 'var(--text-sub)' }}>Review and manage pending applications, active accounts, rejection reasons, and account statuses.</p>
        </div>
        <div>
          <button onClick={fetchDashboardData} className="btn-action" style={{ width: 'auto', padding: '0.6rem 1.4rem' }} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--accent-green)', padding: '0.9rem 1.2rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Admin High Level Metrics */}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.8rem' }}>
        <div className="metric-card">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Pending Registrations</div>
          <div className="metric-val" style={{ color: '#f59e0b' }}>
            {pendingRestaurants.length + pendingDrivers.length + pendingNgos.length}
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Profile Change Requests</div>
          <div className="metric-val" style={{ color: '#00f2fe' }}>
            {changeRequests.length}
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Active Kitchens</div>
          <div className="metric-val" style={{ color: 'var(--accent-green)' }}>
            {allUsers.filter(u => u.roles?.includes('RESTAURANT_OWNER') && u.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Active Riders & NGOs</div>
          <div className="metric-val" style={{ color: '#a855f7' }}>
            {allUsers.filter(u => (u.roles?.includes('DELIVERY_PARTNER') || u.roles?.includes('NGO')) && u.status === 'ACTIVE').length}
          </div>
        </div>
      </div>

      {/* 7 Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={`cat-btn ${activeTab === 'PENDING_RESTAURANTS' ? 'active' : ''}`} onClick={() => setActiveTab('PENDING_RESTAURANTS')}>
          🏪 Pending Restaurants ({pendingRestaurants.length})
        </button>
        <button className={`cat-btn ${activeTab === 'CHANGE_REQUESTS' ? 'active' : ''}`} onClick={() => setActiveTab('CHANGE_REQUESTS')}>
          📋 Change Requests ({changeRequests.length})
        </button>
        <button className={`cat-btn ${activeTab === 'PENDING_DRIVERS' ? 'active' : ''}`} onClick={() => setActiveTab('PENDING_DRIVERS')}>
          🛵 Pending Drivers ({pendingDrivers.length})
        </button>
        <button className={`cat-btn ${activeTab === 'PENDING_NGOS' ? 'active' : ''}`} onClick={() => setActiveTab('PENDING_NGOS')}>
          🤝 Pending NGOs ({pendingNgos.length})
        </button>
        <button className={`cat-btn ${activeTab === 'ACTIVE_USERS' ? 'active' : ''}`} onClick={() => setActiveTab('ACTIVE_USERS')}>
          ✅ Active Users ({activeUsers.length})
        </button>
        <button className={`cat-btn ${activeTab === 'REJECTED_USERS' ? 'active' : ''}`} onClick={() => setActiveTab('REJECTED_USERS')}>
          ❌ Rejected ({rejectedUsers.length})
        </button>
        <button className={`cat-btn ${activeTab === 'SUSPENDED_USERS' ? 'active' : ''}`} onClick={() => setActiveTab('SUSPENDED_USERS')}>
          ⏸️ Suspended ({suspendedUsers.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-sub)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Loading approval workflows and registered profiles...
        </div>
      ) : (
        <>
          {/* TAB 1: PENDING RESTAURANTS */}
          {activeTab === 'PENDING_RESTAURANTS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Pending Restaurant Partner Applications</h3>
              {pendingRestaurants.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No pending restaurant applications. All caught up! 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Restaurant / Owner</th>
                      <th style={{ padding: '0.8rem' }}>Cuisine</th>
                      <th style={{ padding: '0.8rem' }}>Location / City</th>
                      <th style={{ padding: '0.8rem' }}>Reg & License</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRestaurants.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Owner: {item.ownerName || item.name} ({item.ownerEmail || item.email})</div>
                        </td>
                        <td style={{ padding: '0.8rem', color: 'var(--accent-cyan)' }}>{item.cuisineType || 'Multi-Cuisine'}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.address || item.city || item.location || 'Bengaluru'}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                          <div>Reg: <strong>{item.businessRegistrationNumber || 'N/A'}</strong></div>
                          <div>FSSAI: <strong>{item.foodLicenseNumber || 'N/A'}</strong></div>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedItem({ ...item, type: 'Restaurant' })} style={{ background: '#334155', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                              View Details
                            </button>
                            <button onClick={() => handleApprove(item, 'restaurants')} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Approve
                            </button>
                            <button onClick={() => handleOpenRejectModal(item, 'restaurants')} disabled={actionLoading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE CHANGE REQUESTS */}
          {activeTab === 'CHANGE_REQUESTS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', color: '#00f2fe' }}>
                📋 Restaurant Profile Change Requests (Major Identity Updates)
              </h3>
              {changeRequests.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No pending change requests awaiting review. 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Owner / Restaurant</th>
                      <th style={{ padding: '0.8rem' }}>Requested Updates</th>
                      <th style={{ padding: '0.8rem' }}>Rationale / Reason</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff' }}>{req.ownerEmail}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Rest ID: {req.restaurantId}</div>
                        </td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                          {req.requestedRestaurantName && <div>• Name: <strong style={{ color: '#fff' }}>{req.requestedRestaurantName}</strong></div>}
                          {req.requestedAddress && <div>• Address: <strong style={{ color: '#fff' }}>{req.requestedAddress}, {req.requestedCity} {req.requestedPincode}</strong></div>}
                          {req.requestedBusinessRegistrationNumber && <div>• Reg: <strong style={{ color: '#fff' }}>{req.requestedBusinessRegistrationNumber}</strong></div>}
                          {req.requestedFoodLicenseNumber && <div>• FSSAI: <strong style={{ color: '#fff' }}>{req.requestedFoodLicenseNumber}</strong></div>}
                        </td>
                        <td style={{ padding: '0.8rem', color: '#f59e0b', fontStyle: 'italic' }}>
                          "{req.reason || 'No reason specified'}"
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleApproveChangeRequest(req.id)} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Approve & Apply
                            </button>
                            <button onClick={() => handleRejectChangeRequest(req.id)} disabled={actionLoading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: PENDING DRIVERS */}
          {activeTab === 'PENDING_DRIVERS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Pending Delivery Partner Verifications</h3>
              {pendingDrivers.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No pending delivery partner applications. 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Rider Name</th>
                      <th style={{ padding: '0.8rem' }}>Vehicle Type & Number</th>
                      <th style={{ padding: '0.8rem' }}>Verification Info</th>
                      <th style={{ padding: '0.8rem' }}>Contact</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDrivers.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{item.email}</div>
                        </td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ color: '#00f2fe', fontWeight: 700 }}>{item.vehicleType || item.vehicle || 'BIKE'}</span>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Plate: {item.vehicleNumber || 'Pending verification'}</div>
                        </td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.verificationInfo || 'License DL-KA-Verified'}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.phone || 'N/A'}</td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedItem({ ...item, type: 'Delivery Partner' })} style={{ background: '#334155', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                              View Details
                            </button>
                            <button onClick={() => handleApprove(item, 'drivers')} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Approve
                            </button>
                            <button onClick={() => handleOpenRejectModal(item, 'drivers')} disabled={actionLoading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: PENDING NGOS */}
          {activeTab === 'PENDING_NGOS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Pending NGO Food Rescue Partner Applications</h3>
              {pendingNgos.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No pending NGO applications. 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>NGO Organization</th>
                      <th style={{ padding: '0.8rem' }}>Contact Person</th>
                      <th style={{ padding: '0.8rem' }}>Rescue Capacity</th>
                      <th style={{ padding: '0.8rem' }}>Contact Info</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingNgos.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#a855f7' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{item.organizationInfo || 'Food Bank'}</div>
                        </td>
                        <td style={{ padding: '0.8rem', color: '#fff' }}>{item.contactPerson || item.name}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.foodRescueInfo || 'Surplus Food Distribution'}</td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.email}<br />{item.phone}</td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedItem({ ...item, type: 'NGO Partner' })} style={{ background: '#334155', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                              View Details
                            </button>
                            <button onClick={() => handleApprove(item, 'ngos')} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Approve
                            </button>
                            <button onClick={() => handleOpenRejectModal(item, 'ngos')} disabled={actionLoading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 5: ACTIVE USERS */}
          {activeTab === 'ACTIVE_USERS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Active Ecosystem Accounts</h3>
              {activeUsers.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No active users found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Name & Email</th>
                      <th style={{ padding: '0.8rem' }}>Role</th>
                      <th style={{ padding: '0.8rem' }}>Phone</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{item.email}</div>
                        </td>
                        <td style={{ padding: '0.8rem' }}>
                          <span className="badge" style={{ background: 'rgba(0,242,254,0.1)', color: '#00f2fe', borderColor: 'rgba(0,242,254,0.3)', fontSize: '0.75rem' }}>
                            {item.roles ? item.roles.join(', ') : 'CUSTOMER'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', color: 'var(--text-sub)' }}>{item.phone || 'N/A'}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.75rem' }}>
                            ACTIVE
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedItem({ ...item, type: 'Active Profile' })} style={{ background: '#334155', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Details
                            </button>
                            <button onClick={() => handleSuspend(item)} disabled={actionLoading} style={{ background: '#94a3b8', border: 'none', color: '#0f172a', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                              Suspend
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: REJECTED APPLICATIONS */}
          {activeTab === 'REJECTED_USERS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Rejected Applications Queue</h3>
              {rejectedUsers.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No rejected applications.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>Applicant</th>
                      <th style={{ padding: '0.8rem' }}>Role</th>
                      <th style={{ padding: '0.8rem' }}>Rejection Reason</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedUsers.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{item.email}</div>
                        </td>
                        <td style={{ padding: '0.8rem' }}>{item.roles ? item.roles.join(', ') : 'USER'}</td>
                        <td style={{ padding: '0.8rem', color: '#fca5a5' }}>
                          <em>"{item.rejectionReason || 'Verification failed'}"</em>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <button onClick={() => handleReactivate(item)} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                            Re-Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 7: SUSPENDED USERS */}
          {activeTab === 'SUSPENDED_USERS' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>Suspended Accounts</h3>
              {suspendedUsers.length === 0 ? (
                <div style={{ color: 'var(--text-sub)', padding: '2rem', textAlign: 'center' }}>No suspended accounts.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-sub)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem' }}>User / Business</th>
                      <th style={{ padding: '0.8rem' }}>Role</th>
                      <th style={{ padding: '0.8rem' }}>Status</th>
                      <th style={{ padding: '0.8rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suspendedUsers.map((item) => (
                      <tr key={item.id || item._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <strong style={{ color: '#fff' }}>{item.name}</strong>
                          <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{item.email}</div>
                        </td>
                        <td style={{ padding: '0.8rem' }}>{item.roles ? item.roles.join(', ') : 'USER'}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                            SUSPENDED
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <button onClick={() => handleReactivate(item)} disabled={actionLoading} style={{ background: 'var(--accent-green)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                            Reactivate Account
                          </button>
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

      {/* VIEW DETAILS MODAL */}
      {selectedItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', margin: 0, color: '#fff' }}>
                📋 {selectedItem.type || 'Profile'} Full Verification Dossier
              </h3>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Entity / Business Name</span>
                <strong style={{ color: '#fff' }}>{selectedItem.name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Owner / Account Email</span>
                <strong style={{ color: '#fff' }}>{selectedItem.email || selectedItem.ownerEmail}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Phone Number</span>
                <strong style={{ color: '#fff' }}>{selectedItem.phone || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Account Status</span>
                <strong style={{ color: selectedItem.status === 'ACTIVE' ? 'var(--accent-green)' : '#f59e0b' }}>{selectedItem.status}</strong>
              </div>

              {selectedItem.cuisineType && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Cuisine Category</span>
                  <strong style={{ color: '#00f2fe' }}>{selectedItem.cuisineType}</strong>
                </div>
              )}
              {selectedItem.openingTime && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Operating Hours</span>
                  <strong style={{ color: '#fff' }}>{selectedItem.openingTime} – {selectedItem.closingTime || '10:00 PM'}</strong>
                </div>
              )}

              {/* RESTAURANT SECTION C DETAILS */}
              {selectedItem.businessRegistrationNumber && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Business Registration Number</span>
                  <strong style={{ color: 'var(--accent-green)' }}>{selectedItem.businessRegistrationNumber}</strong>
                </div>
              )}
              {selectedItem.foodLicenseNumber && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>FSSAI / Food License Number</span>
                  <strong style={{ color: 'var(--accent-green)' }}>{selectedItem.foodLicenseNumber}</strong>
                </div>
              )}

              {selectedItem.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Description</span>
                  <p style={{ margin: '2px 0', color: 'var(--text-sub)' }}>{selectedItem.description}</p>
                </div>
              )}

              {selectedItem.verificationDocumentUrl && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Verification Document Notes</span>
                  <p style={{ margin: '2px 0', color: '#00f2fe' }}>{selectedItem.verificationDocumentUrl}</p>
                </div>
              )}

              {selectedItem.vehicleType && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Vehicle Type & Number</span>
                  <strong style={{ color: '#00f2fe' }}>{selectedItem.vehicleType} ({selectedItem.vehicleNumber || 'N/A'})</strong>
                </div>
              )}
              {selectedItem.verificationInfo && (
                <div>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>License / ID Verification</span>
                  <strong style={{ color: '#fff' }}>{selectedItem.verificationInfo}</strong>
                </div>
              )}
              {selectedItem.organizationInfo && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Organization Mission</span>
                  <strong style={{ color: '#a855f7' }}>{selectedItem.organizationInfo}</strong>
                </div>
              )}
              {selectedItem.foodRescueInfo && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Rescue & Distribution Info</span>
                  <strong style={{ color: '#fff' }}>{selectedItem.foodRescueInfo}</strong>
                </div>
              )}
              {selectedItem.address && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.75rem' }}>Address / City</span>
                  <span style={{ color: '#fff' }}>{selectedItem.address} {selectedItem.city ? `(${selectedItem.city}, ${selectedItem.pincode})` : ''}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setSelectedItem(null)} className="btn-action" style={{ width: 'auto', padding: '0.5rem 1.5rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL WITH REASON PROMPT */}
      {rejectingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', border: '1px solid #ef4444' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: '#ef4444', marginBottom: '0.5rem' }}>
              Reject Application for {rejectingItem.name}
            </h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Please provide an optional reason for rejecting this application. This will be shown to the applicant on their status page.
            </p>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '4px' }}>Rejection Feedback / Reason</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete restaurant license documentation, or vehicle number mismatch."
                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid var(--bg-card-border)', padding: '0.8rem', borderRadius: '10px', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectingItem(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleConfirmReject} disabled={actionLoading} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
