import React, { useState, useEffect, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Menu, X, Truck, User, Calendar, LogOut, Navigation, History, PlayCircle, RotateCcw } from 'lucide-react';
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
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isSheetExpanded, setSheetExpanded] = useState(false);
  const [mode, setMode] = useState('live');
  const [selectedDate, setSelectedDate] = useState('');
  const [historyPoints, setHistoryPoints] = useState([]);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'fleet') {
      setCurrentUser({ mobile: 'Fleet-Manager' });
      setStep('map');
      return;
    }

    const saved = localStorage.getItem('tracker_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        setStep('map');
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
        setStep('map');
        localStorage.setItem('tracker_user', JSON.stringify(res.data.user));
      }
    } catch { setError('Invalid OTP'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('tracker_user');
    setStep('login');
    setCurrentUser(null);
  };

  const selectTruck = (truck) => {
    setSelectedDevice(truck);
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
    setSelectedDevice(null);
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
      {step === 'login' || step === 'otp' ? (
        <div className="login-screen">
          <div className="login-card glass animate-fade">
            <div className="login-header">
              <div className="brand-icon">🚛</div>
              <h1>FleetOps</h1>
              <p>Real-time Asset Intelligence</p>
            </div>

            <form onSubmit={step === 'login' ? handleLogin : handleVerify} style={{ marginTop: 32 }}>
              <div className="input-group">
                <label className="input-label">{step === 'login' ? "Mobile Number" : "Verification Code"}</label>
                <input
                  className="modern-input"
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

            <div className="login-footer">
              <p>Secure Enterprise Tracking System</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="map-viewport">
          {mode !== 'live' && (
            <div className={`mode-banner glass animate-fade ${mode}`}>
              {mode === 'nav' ? <Navigation size={18} /> : <Calendar size={18} />}
              <span>{mode === 'nav' ? `Routing to ${selectedDevice?.mobile}` : `History: ${selectedDate}`}</span>
              <X size={18} style={{ marginLeft: 10, cursor: 'pointer', pointerEvents: 'auto' }} onClick={resetView} />
            </div>
          )}

          <button className="fab glass" style={{ position: 'absolute', top: 24, left: 24, zIndex: 1100 }} onClick={() => setSidebarOpen(true)}>
            <Menu size={24} color="var(--primary-bright)" />
          </button>

          {/* Fiori-inspired KPI Row */}
          <div className="kpi-row animate-fade">
            <div className="kpi-card glass">
              <span className="kpi-label">TOTAL ASSETS</span>
              <span className="kpi-value">{users.length}</span>
            </div>
            <div className="kpi-card glass">
              <span className="kpi-label">ACTIVE</span>
              <span className="kpi-value" style={{ color: 'var(--success)' }}>
                {users.filter(u => getStatus(u.last_updated) === 'active').length}
              </span>
            </div>
            <div className="kpi-card glass">
              <span className="kpi-label">CRITICAL (OFFLINE)</span>
              <span className="kpi-value" style={{ color: 'var(--danger)' }}>
                {users.filter(u => getStatus(u.last_updated) === 'offline').length}
              </span>
            </div>
          </div>

          {/* Live Broadcasting Indicator */}
          <div className="glass broadcasting-indicator" style={{
            position: 'absolute',
            top: 24,
            right: 24,
            zIndex: 1100,
            padding: '10px 16px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div className={`status-dot ${isTransmitting ? 'transmitting' : 'ready'}`}></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-sub)', letterSpacing: '0.1em' }}>GPS STATUS</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                {isTransmitting ? 'LIVE STREAM' : 'SIGNAL READY'}
              </span>
            </div>
          </div>

          <div className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>
          <div className={`primary-sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="pulse-me" style={{ width: 10, height: 10 }}></div>
                <span style={{ fontWeight: 700 }}>FLEET OPS</span>
              </div>
              <button className="fab" style={{ width: 32, height: 32, background: 'none', border: 'none' }} onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            </div>

            <div className="sidebar-content">
              <div style={{ marginBottom: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <User size={18} color="var(--primary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{currentUser?.mobile}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={fetchDevices} className="fab glass" style={{ width: 32, height: 32 }}><RotateCcw size={14} /></button>
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={18} color="var(--text-sub)" /></button>
                </div>
              </div>

              <div className="glass" style={{ padding: 16, borderRadius: 12, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1px' }}>
                  <History size={16} /> MY HISTORY
                </div>
                <input
                  type="date"
                  className="modern-input"
                  style={{ padding: '10px', fontSize: '0.85rem' }}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    fetchHistory(e.target.value, currentUser.mobile);
                  }}
                />
              </div>

              <div className="category-label">FLEET REGIONS</div>
              {Object.entries(groupedUsers).map(([region, regionUsers]) => (
                <div key={region} className="sidebar-category">
                  <div className="region-header">
                    <span className="region-name">{region}</span>
                    <span className="region-count">{regionUsers.length}</span>
                  </div>
                  {regionUsers.map(u => {
                    const status = getStatus(u.last_updated);
                    return (
                      <div
                        key={u.mobile}
                        className={`device-card glass ${selectedDevice?.mobile === u.mobile ? 'selected' : ''}`}
                        onClick={() => selectTruck(u)}
                      >
                        <Truck size={22} color={status === 'offline' ? 'var(--text-sub)' : 'var(--primary-bright)'} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{u.mobile}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--primary-bright)', fontWeight: 800, background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                              DEL: {u.mobile.split('-').pop().padStart(6, '0')}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 500 }}>
                            {status === 'active' ? '🟢 Active Logistics' : '🔴 Tracking Paused'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <MapComponent
            users={users}
            currentUserMobile={currentUser?.mobile}
            selectedDevice={selectedDevice}
            historyPoints={historyPoints}
            mode={mode}
            onReset={resetView}
            onDistanceUpdate={handleDistanceUpdate}
          />

          {selectedDevice && mode !== 'history' && (
            <div className={`bottom-sheet glass ${isSheetExpanded ? 'expanded' : 'visible'}`}>
              <div className="sheet-handle" onClick={() => setSheetExpanded(!isSheetExpanded)}></div>
              <div className="sheet-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedDevice.mobile}</h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary-bright)', fontWeight: 800, marginTop: -4, marginBottom: 4 }}>
                    SAP DELIVERY: {selectedDevice.mobile.split('-').pop().padStart(6, '0')}
                  </div>
                  <span className={`badge ${getStatus(selectedDevice.last_updated) === 'active' ? 'badge-active' : 'badge-offline'}`}>
                    {getStatus(selectedDevice.last_updated)}
                  </span>
                </div>
                <button className="fab glass" style={{ width: 36, height: 36 }} onClick={() => setSelectedDevice(null)}><X size={20} /></button>
              </div>

              <div className="sheet-content">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 600, marginBottom: 4 }}>LAST SEEN</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{new Date(selectedDevice.last_updated).toLocaleTimeString()}</div>
                  </div>
                  <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 600, marginBottom: 4 }}>
                      {mode === 'nav' ? 'DISTANCE' : 'REGION'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {mode === 'nav' && distance !== null
                        ? (distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`)
                        : 'Logistics Zone A'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={enterNavMode}>
                    <Navigation size={18} /> Navigate
                  </button>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="date"
                      className="modern-input"
                      style={{ padding: '10px' }}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        fetchHistory(e.target.value, selectedDevice.mobile);
                      }}
                    />
                    {!selectedDate && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-sub)', fontSize: '0.85rem' }}><History size={16} /> History</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'history' && (
            <div className="timeline-container glass animate-fade">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}><PlayCircle size={36} color="var(--primary)" /></button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4 }}>MOVEMENT TIMELINE</div>
                  <input type="range" className="custom-slider" min="0" max="100" defaultValue="0" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
