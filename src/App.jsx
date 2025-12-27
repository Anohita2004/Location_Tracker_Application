import React, { useState, useEffect, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Menu, X, Truck, User, Calendar, LogOut, Navigation, History, PlayCircle } from 'lucide-react';
import MapComponent from './MapComponent';

const socket = io();

function App() {
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

  useEffect(() => {
    socket.on('initial-data', setUsers);
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
  }, []);

  useEffect(() => {
    if (step === 'map' && currentUser) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          axios.post('/api/update-location', {
            mobile: currentUser.mobile,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }).catch(err => console.error(err));
        },
        (err) => {
          if (err.code === 3) setError('GPS connection slow...');
          else setError('Location permission required');
        },
        { enableHighAccuracy: true, timeout: 60000, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [step, currentUser]);

  const getStatus = useCallback((lastUpdated) => {
    if (!lastUpdated) return 'offline';
    const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60;
    return diff > 15 ? 'offline' : 'active';
  }, []);

  const groupedUsers = useMemo(() => {
    const groups = { North: [], South: [], East: [], West: [] };
    users.forEach(u => {
      if (u.mobile === currentUser?.mobile) return;
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
    } catch { setError('Login failed'); }
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
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🚛</div>
            <h1>FleetOps</h1>
            <p className="input-label" style={{ textAlign: 'center' }}>Real-time Asset Intelligence</p>

            <form onSubmit={step === 'login' ? handleLogin : handleVerify} style={{ marginTop: 40 }}>
              <div className="input-group">
                <label className="input-label">{step === 'login' ? "MOBILE" : "OTP"}</label>
                <input
                  className="modern-input"
                  value={step === 'login' ? mobile : otp}
                  onChange={e => step === 'login' ? setMobile(e.target.value) : setOtp(e.target.value)}
                  placeholder={step === 'login' ? "Mobile Number" : "1234"}
                  autoFocus={step === 'otp'}
                />
                {step === 'otp' && <small style={{ display: 'block', marginTop: 10, color: 'var(--text-sub)' }}>Test Code: <strong>1234</strong></small>}
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 20 }}>{error}</p>}
              <button className="btn-primary" type="submit">
                {step === 'login' ? "Get Started" : "Verify"}
              </button>
            </form>
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

          <button className="fab glass" style={{ position: 'absolute', top: 20, left: 20, zIndex: 100 }} onClick={() => setSidebarOpen(true)}>
            <Menu size={24} color="var(--primary)" />
          </button>

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
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={18} color="var(--text-sub)" /></button>
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
                  <div className="category-label">{region} ({regionUsers.length})</div>
                  {regionUsers.map(u => {
                    const status = getStatus(u.last_updated);
                    return (
                      <div
                        key={u.mobile}
                        className={`device-card glass ${selectedDevice?.mobile === u.mobile ? 'selected' : ''}`}
                        onClick={() => selectTruck(u)}
                      >
                        <Truck size={20} color={status === 'offline' ? 'var(--text-sub)' : 'var(--primary)'} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{u.mobile}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>
                            {status === 'active' ? '🟢 Active' : '🔴 Offline'}
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
