import React, { useState, useEffect, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Menu, X, Truck, User, Calendar, LogOut, Navigation, History, PlayCircle, RotateCcw, Home, LayoutList, Bell, Search, Star, HelpCircle, Settings, ChevronRight } from 'lucide-react';
import MapComponent from './MapComponent';

import { Geolocation } from '@capacitor/geolocation';

const socket = io();

function App() {
  // Configure Axios defaults
  axios.defaults.baseURL = '/';

  const [step, setStep] = useState('loading');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');

  // UI State
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedMobile, setSelectedMobile] = useState(null);
  const selectedDevice = useMemo(() =>
    users.find(u => u.mobile === selectedMobile),
    [users, selectedMobile]
  );
  const [isSheetExpanded, setSheetExpanded] = useState(false);
  const [mode, setMode] = useState('live');
  const [selectedDate, setSelectedDate] = useState('');
  const [historyPoints, setHistoryPoints] = useState([]);
  const [distance, setDistance] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // home, fleet, map, tracking
  const [activeFleetSubTab, setActiveFleetSubTab] = useState('vehicles'); // drivers, vehicles
  const [profileForm, setProfileForm] = useState({ name: '', role: 'Driver', vehicle_type: 'Heavy Truck' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'fleet') {
      setCurrentUser({ mobile: 'Fleet-Manager', name: 'Fleet Manager', role: 'Manager' });
      setStep('map');
      return;
    }

    const saved = localStorage.getItem('tracker_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        if (!u.name && u.mobile !== 'Fleet-Manager') {
          setStep('profile');
        } else {
          setStep('map');
        }
      } catch (e) { setStep('login'); }
    } else {
      setStep('login');
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await axios.get('/api/devices');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  }, []);

  useEffect(() => {
    fetchDevices(); // Initial fetch

    socket.on('initial-data', (data) => {
      setUsers(data);
    });

    socket.on('location-update', (updatedUser) => {
      setUsers(prev => {
        const idx = prev.findIndex(u => u.mobile === updatedUser.mobile);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = updatedUser;
          return next;
        }
        return [...prev, updatedUser];
      });
    });

    return () => {
      socket.off('initial-data');
      socket.off('location-update');
    };
  }, [fetchDevices]);

  const [isTransmitting, setIsTransmitting] = useState(false);

  useEffect(() => {
    let watchId = null;

    const startTracking = async () => {
      if (step === 'map' && currentUser) {
        try {
          const permission = await Geolocation.requestPermissions();
          if (permission.location !== 'granted') {
            setError('Location permission denied');
            return;
          }

          watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
            async (pos, err) => {
              if (err) {
                console.error('GPS Error:', err);
                setError('GPS signal weak or unavailable');
                return;
              }
              if (pos) {
                setIsTransmitting(true);
                try {
                  await axios.post('/api/update-location', {
                    mobile: currentUser.mobile,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                  });
                  setError(''); // Clear any previous GPS errors
                } catch (apiErr) {
                  console.error(apiErr);
                } finally {
                  setTimeout(() => setIsTransmitting(false), 800);
                }
              }
            }
          );
        } catch (e) {
          setError('Error initializing GPS: ' + e.message);
        }
      }
    };

    startTracking();

    return () => {
      if (watchId != null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [step, currentUser]);

  const getStatus = useCallback((lastUpdated) => {
    if (!lastUpdated) return 'offline';
    const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60;
    return diff > 15 ? 'offline' : 'active';
  }, []);

  const groupedUsers = useMemo(() => {
    const groups = { North: [], South: [], East: [], West: [] };
    users.forEach(u => {
      if (!u.mobile || u.mobile === currentUser?.mobile) return;
      if (u.mobile.startsWith('North')) groups.North.push(u);
      else if (u.mobile.startsWith('South')) groups.South.push(u);
      else if (u.mobile.startsWith('East')) groups.East.push(u);
      else if (u.mobile.startsWith('West')) groups.West.push(u);
      else groups.North.push(u);
    });
    return groups;
  }, [users, currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!mobile) return setError('Enter mobile');
    try {
      await axios.post('/api/login', { mobile });
      setStep('otp');
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/verify-otp', { mobile, otp });
      if (res.data.success) {
        setCurrentUser(res.data.user);
        localStorage.setItem('tracker_user', JSON.stringify(res.data.user));
        if (res.data.needsProfile) {
          setStep('profile');
        } else {
          setStep('map');
        }
      }
    } catch { setError('Invalid OTP'); }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profileForm.name) return setError('Please enter your name');
    try {
      const res = await axios.post('/api/update-profile', {
        mobile: currentUser.mobile,
        ...profileForm
      });
      if (res.data.success) {
        setCurrentUser(res.data.user);
        localStorage.setItem('tracker_user', JSON.stringify(res.data.user));
        setStep('map');
      }
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracker_user');
    setStep('login');
    setCurrentUser(null);
  };

  const selectTruck = (truck) => {
    setSelectedMobile(truck.mobile);
    setSidebarOpen(false);
    setSheetExpanded(false);
    setMode('live');
    setHistoryPoints([]);
    setSelectedDate('');
  };

  const enterNavMode = () => {
    setMode('nav');
    setSheetExpanded(false);
  };

  const fetchHistory = (date, targetMobile) => {
    axios.get(`/api/history?mobile=${targetMobile}&date=${date}`)
      .then(res => {
        setHistoryPoints(res.data.history);
        if (res.data.history.length > 0) {
          setMode('history');
          setSidebarOpen(false);
          setSheetExpanded(false);
        } else {
          setError('No history found');
          setTimeout(() => setError(''), 3000);
        }
      });
  };

  const resetView = () => {
    setMode('live');
    setSelectedMobile(null);
    setHistoryPoints([]);
    setSelectedDate('');
    setDistance(null);
  };

  const handleDistanceUpdate = (dist) => {
    setDistance(dist);
  };

  if (step === 'loading') return <div className="login-screen"><div className="pulse-me"></div></div>;

  return (
    <div className="app-container">
      {step === 'login' || step === 'otp' || step === 'profile' ? (
        <div className="login-screen">
          <div className="login-card glass animate-fade" style={{ background: 'white' }}>
            {step === 'profile' ? (
              <>
                <div className="login-header">
                  <div className="brand-icon" style={{ filter: 'none' }}>👤</div>
                  <h1 style={{ background: 'none', WebkitTextFillColor: 'var(--text-main)', color: 'var(--text-main)' }}>Create Profile</h1>
                  <p style={{ color: 'var(--text-sub)' }}>Let's personalize your fleet experience</p>
                </div>
                <form onSubmit={handleProfileSubmit} style={{ marginTop: 32 }}>
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary)' }}>Full Name</label>
                    <input
                      className="modern-input"
                      style={{ background: '#f8fafc', color: 'var(--text-main)' }}
                      value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary)' }}>Role</label>
                    <select
                      className="modern-input"
                      style={{ background: '#f8fafc', color: 'var(--text-main)' }}
                      value={profileForm.role}
                      onChange={e => setProfileForm({ ...profileForm, role: e.target.value })}
                    >
                      <option value="Driver">Driver</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Fleet Manager">Fleet Manager</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary)' }}>Vehicle Type</label>
                    <input
                      className="modern-input"
                      style={{ background: '#f8fafc', color: 'var(--text-main)' }}
                      value={profileForm.vehicle_type}
                      onChange={e => setProfileForm({ ...profileForm, vehicle_type: e.target.value })}
                      placeholder="e.g. Heavy Truck, Van"
                    />
                  </div>
                  {error && <div className="error-message animate-fade">{error}</div>}
                  <button className="btn-primary" type="submit">Complete Registration</button>
                </form>
              </>
            ) : (
              <>
                <div className="login-header">
                  <div className="brand-icon" style={{ filter: 'none' }}>🚛</div>
                  <h1 style={{ background: 'none', WebkitTextFillColor: 'var(--text-main)', color: 'var(--text-main)' }}>FleetOps</h1>
                  <p style={{ color: 'var(--text-sub)' }}>Real-time Asset Intelligence</p>
                </div>

                <form onSubmit={step === 'login' ? handleLogin : handleVerify} style={{ marginTop: 32 }}>
                  <div className="input-group">
                    <label className="input-label" style={{ color: 'var(--primary)' }}>{step === 'login' ? "Mobile Number" : "Verification Code"}</label>
                    <input
                      className="modern-input"
                      style={{ background: '#f8fafc', color: 'var(--text-main)' }}
                      value={step === 'login' ? mobile : otp}
                      onChange={e => step === 'login' ? setMobile(e.target.value) : setOtp(e.target.value)}
                      placeholder={step === 'login' ? "00000 00000" : "Enter 4-digit OTP"}
                      autoFocus={step === 'otp'}
                      type={step === 'login' ? "tel" : "text"}
                    />
                    {step === 'otp' && (
                      <div className="otp-hint">
                        <span>Test Code: <strong>1234</strong></span>
                      </div>
                    )}
                  </div>
                  {error && <div className="error-message animate-fade">{error}</div>}
                  <button className="btn-primary" type="submit">
                    {step === 'login' ? "Get Started" : "Verify & Continue"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="app-container">
          <div className="view-container animate-fade">
            {activeTab === 'home' && (
              <div className="home-view">
                <div className="user-header">
                  <div className="profile-pill">
                    <div className="avatar" style={{ background: currentUser?.avatar_color || 'var(--primary-glow)', color: 'white' }}>
                      {currentUser?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Welcome back,</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentUser?.name || currentUser?.mobile}</div>
                    </div>
                  </div>
                  <div className="fab" style={{ background: '#f1f5f9', width: 44, height: 44 }}><Bell size={20} /></div>
                </div>

                <div className="card-elevated" style={{ background: 'var(--primary)', color: 'white', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }}><Truck size={120} /></div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>Fleet Performance</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Live tracking is active</div>
                  <div className="kpi-grid" style={{ marginTop: 20 }}>
                    <div className="kpi-item">
                      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{users.length}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.7 }}>TOTAL TRUCKS</div>
                    </div>
                    <div className="kpi-item">
                      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{users.filter(u => getStatus(u.last_updated) === 'active').length}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.7 }}>ON BROADCAST</div>
                    </div>
                  </div>
                </div>

                <div className="card-elevated">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700 }}>Fleet Activity</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>See all</div>
                  </div>
                  <div className="chart-area">
                    <svg className="wave-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <path d="M0 25 C 20 20, 40 28, 60 22 S 80 15, 100 25 V 30 H 0 Z" />
                      <path d="M0 25 C 20 20, 40 28, 60 22 S 80 15, 100 25" fill="none" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                      <span key={day} style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 600 }}>{day}</span>
                    ))}
                  </div>
                </div>

                <div className="card-elevated">
                  <div style={{ fontWeight: 700, marginBottom: 16 }}>Critical Deadlines</div>
                  {[
                    { title: 'Oil Change', sub: 'Due Jan 15, 2024', icon: '🔧', color: 'var(--danger)' },
                    { title: 'Filter Change', sub: 'Due Jan 16, 2024', icon: '🛡️', color: 'var(--primary)' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 12 }}>
                      <div style={{ fontSize: '1.2rem' }}>{item.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{item.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{item.sub}</div>
                      </div>
                      <ChevronRight size={18} color="var(--text-sub)" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'fleet' && (
              <div className="fleet-view">
                <div className="list-report-header">
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Fleet</h2>
                  <div className="search-bar">
                    <Search size={18} color="var(--text-sub)" />
                    <input style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }} placeholder="Search vehicles or drivers..." />
                  </div>
                </div>

                <div className="tabs-row">
                  <div className={`tab-btn ${activeFleetSubTab === 'drivers' ? 'active' : ''}`} onClick={() => setActiveFleetSubTab('drivers')}>Drivers</div>
                  <div className={`tab-btn ${activeFleetSubTab === 'vehicles' ? 'active' : ''}`} onClick={() => setActiveFleetSubTab('vehicles')}>Vehicles</div>
                </div>

                <div className="fleet-list">
                  {users.map(u => {
                    const status = getStatus(u.last_updated);
                    return (
                      <div key={u.mobile} className="driver-item" onClick={() => { selectTruck(u); setActiveTab('map'); }}>
                        <div className="avatar" style={{ background: u.avatar_color || '#f1f5f9', color: u.avatar_color ? 'white' : 'inherit' }}>
                          {u.name?.charAt(0) || u.mobile.charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{u.name || u.mobile}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{u.vehicle_type || 'General Cargo'} • {u.mobile}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="rating-badge"><Star size={10} fill="currentColor" /> 4.9</div>
                          <div className={`status-chip ${status === 'active' ? 'chip-active' : 'chip-offline'}`} style={{ marginTop: 4 }}>
                            {status === 'active' ? 'MOVING' : 'IDLE'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <div className="map-view" style={{ height: '100%', position: 'absolute', inset: 0, padding: 0 }}>
                <MapComponent
                  users={users}
                  currentUserMobile={currentUser?.mobile}
                  selectedDevice={selectedDevice}
                  historyPoints={historyPoints}
                  mode={mode}
                  onReset={resetView}
                  onDistanceUpdate={handleDistanceUpdate}
                  onSelectTruck={selectTruck}
                />

                {selectedDevice && (
                  <div className="bottom-sheet glass expanded" style={{
                    background: 'white',
                    borderRadius: '24px 24px 0 0',
                    position: 'absolute',
                    bottom: 80,
                    height: 'auto',
                    padding: '16px 20px 24px',
                    boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)',
                    maxHeight: '60vh',
                    overflowY: 'auto'
                  }}>
                    <div className="sheet-handle"></div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
                      <div style={{ width: 64, height: 64, background: selectedDevice.avatar_color || 'var(--primary-glow)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white' }}>
                        {selectedDevice.name?.charAt(0) || '🚛'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedDevice.name || selectedDevice.mobile}</div>
                          <div className={`status-chip ${getStatus(selectedDevice.last_updated) === 'active' ? 'chip-active' : 'chip-offline'}`}>
                            {getStatus(selectedDevice.last_updated)}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 600, marginTop: 2 }}>
                          {selectedDevice.vehicle_type || 'Fleet Asset'} • {selectedDevice.mobile}
                        </div>

                        {/* ABAP Metadata Section */}
                        <div style={{ marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.05em', marginBottom: 8 }}>ABAP BACKEND INFORMATION</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-sub)' }}>Status:</span> <span style={{ fontWeight: 600 }}>{selectedDevice.metadata?.Status || 'Syncing...'}</span></div>
                            <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-sub)' }}>Load:</span> <span style={{ fontWeight: 600 }}>{selectedDevice.metadata?.Load_Weight || '75%'}</span></div>
                            <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-sub)' }}>Next Stop:</span> <span style={{ fontWeight: 600 }}>{selectedDevice.metadata?.Next_Hub || 'N/A'}</span></div>
                            <div style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-sub)' }}>ETA:</span> <span style={{ fontWeight: 600 }}>{selectedDevice.metadata?.ETA || 'Calculating...'}</span></div>
                          </div>
                          {selectedDevice.metadata && Object.keys(selectedDevice.metadata).length > 4 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                              {Object.entries(selectedDevice.metadata).map(([key, val]) => (
                                !['Status', 'Load_Weight', 'Next_Hub', 'ETA'].includes(key) && (
                                  <div key={key} style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                    <span style={{ color: 'var(--text-sub)' }}>{key}:</span> <span style={{ fontWeight: 600 }}>{typeof val === 'object' ? JSON.stringify(val) : val}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <div style={{ background: 'white', padding: '6px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
                            📍 {selectedDevice.lat.toFixed(4)}, {selectedDevice.lng.toFixed(4)}
                          </div>
                          <div style={{ background: 'white', padding: '6px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', border: '1px solid var(--border-subtle)' }}>
                            🕒 {new Date(selectedDevice.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }} onClick={enterNavMode}>Track Route</button>
                      <button className="btn-primary" style={{ flex: 1, background: 'white', color: 'var(--text-main)', boxShadow: 'none', border: '1px solid var(--border-subtle)', padding: '12px', fontSize: '0.9rem' }} onClick={() => setSelectedMobile(null)}>Dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tracking' && (
              <div className="tracking-view">
                <div className="user-header">
                  <h2 style={{ fontWeight: 800 }}>Spending</h2>
                </div>
                {/* Spend Analysis Chart inspired by mockup */}
                <div className="card-elevated" style={{ padding: 32 }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 600 }}>SEPTEMBER TOTAL</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>$1,234</div>
                  </div>
                  <div className="chart-area" style={{ height: 200 }}>
                    <svg className="wave-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <path d="M0 25 C 20 10, 40 28, 60 15 S 80 5, 100 20 V 30 H 0 Z" />
                      <line x1="60" y1="0" x2="60" y2="30" stroke="var(--primary)" strokeDasharray="2" opacity="0.3" />
                    </svg>
                  </div>
                </div>

                <div className="card-elevated">
                  <div style={{ fontWeight: 700, marginBottom: 16 }}>Invoices List</div>
                  {['Reliance', 'Shell', 'Ford Motors'].map((name, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 10 }}></div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>LKW {3800 + idx}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--danger)' }}>-$110.00</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="profile-view">
                <div className="user-header">
                  <h2 style={{ fontWeight: 800 }}>Profile Settings</h2>
                </div>

                <div className="card-elevated" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div className="avatar" style={{
                    width: 80,
                    height: 80,
                    margin: '0 auto 16px',
                    fontSize: '2rem',
                    background: currentUser?.avatar_color || 'var(--primary)',
                    color: 'white',
                    border: '4px solid white',
                    boxShadow: 'var(--shadow-md)'
                  }}>
                    {currentUser?.name?.charAt(0) || 'U'}
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{currentUser?.name || 'User'}</h3>
                  <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>{currentUser?.role || 'Fleet Personnel'} • {currentUser?.mobile}</p>
                </div>

                <div className="card-elevated" style={{ padding: 0, overflow: 'hidden' }}>
                  {[
                    { label: 'Edit Profile', icon: <User size={18} />, action: () => setStep('profile') },
                    { label: 'Notifications', icon: <Bell size={18} /> },
                    { label: 'Security', icon: <Settings size={18} /> },
                    { label: 'Help Center', icon: <HelpCircle size={18} /> },
                    { label: 'Sign Out', icon: <LogOut size={18} />, color: 'var(--danger)', action: handleLogout },
                  ].map((item, idx) => (
                    <div key={idx}
                      onClick={item.action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '20px 24px',
                        borderBottom: idx === 4 ? 'none' : '1px solid #f1f5f9',
                        cursor: 'pointer',
                        color: item.color || 'inherit',
                        transition: 'background 0.2s'
                      }}
                      className="profile-menu-item"
                    >
                      <div style={{ opacity: 0.7 }}>{item.icon}</div>
                      <span style={{ fontWeight: 600, flex: 1 }}>{item.label}</span>
                      <ChevronRight size={18} opacity={0.3} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bottom-nav">
            <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
              <Home size={24} />
              <span>Home</span>
            </div>
            <div className={`nav-item ${activeTab === 'fleet' ? 'active' : ''}`} onClick={() => setActiveTab('fleet')}>
              <Truck size={24} />
              <span>Fleet</span>
            </div>
            <div className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
              <Navigation size={24} />
              <span>Map</span>
            </div>
            <div className={`nav-item ${activeTab === 'tracking' ? 'active' : ''}`} onClick={() => setActiveTab('tracking')}>
              <LayoutList size={24} />
              <span>Spendings</span>
            </div>
            <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <User size={24} />
              <span>Profile</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
