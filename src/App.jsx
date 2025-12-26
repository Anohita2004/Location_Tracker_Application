import React, { useState, useEffect, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import MapComponent from './MapComponent';
import { Menu, X, Navigation, Truck, User, Calendar, LogOut } from 'lucide-react';

// Initialize socket connection to backend
const socket = io('http://localhost:3000');

function App() {
  const [step, setStep] = useState('loading'); // 'loading', 'login', 'otp', 'map'
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');

  // Sidebar & Navigation State
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [historyPoints, setHistoryPoints] = useState([]);

  // Check for saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('tracker_user');
    if (savedUser) {
      try {
        const userFn = JSON.parse(savedUser);
        if (userFn && userFn.mobile) {
          setCurrentUser(userFn);
          setStep('map');
        } else {
          setStep('login');
        }
      } catch (e) {
        setStep('login');
      }
    } else {
      setStep('login');
    }
  }, []);

  // Group Users by Region
  const groupedUsers = useMemo(() => {
    const groups = { North: [], South: [], East: [], West: [] };
    users.forEach(u => {
      if (u.mobile === currentUser?.mobile) return;
      if (u.lat >= 22) {
        if (u.lng < 79) groups.North.push(u);
        else groups.East.push(u);
      } else {
        if (u.lng < 76) groups.West.push(u);
        else if (u.lng > 85) groups.East.push(u);
        else groups.South.push(u);
      }
    });
    users.forEach(u => {
      if (u.mobile.startsWith('North')) { if (!groups.North.includes(u)) groups.North.push(u); }
      else if (u.mobile.startsWith('South')) { if (!groups.South.includes(u)) groups.South.push(u); }
      else if (u.mobile.startsWith('East')) { if (!groups.East.includes(u)) groups.East.push(u); }
      else if (u.mobile.startsWith('West')) { if (!groups.West.includes(u)) groups.West.push(u); }
    });
    Object.keys(groups).forEach(k => {
      const seen = new Set();
      groups[k] = groups[k].filter(item => {
        const curr = item.mobile;
        if (seen.has(curr)) return false;
        seen.add(curr);
        return true;
      });
    });
    return groups;
  }, [users, currentUser]);


  // Socket: Listen for updates
  useEffect(() => {
    socket.on('initial-data', (data) => {
      setUsers(data);
    });
    socket.on('location-update', (updatedUser) => {
      setUsers(prev => {
        const idx = prev.findIndex(u => u.mobile === updatedUser.mobile);
        if (idx > -1) {
          const newUsers = [...prev];
          newUsers[idx] = updatedUser;
          return newUsers;
        } else {
          return [...prev, updatedUser];
        }
      });
    });
    return () => {
      socket.off('initial-data');
      socket.off('location-update');
    };
  }, []);

  // Fetch History
  useEffect(() => {
    if (currentUser && selectedDate) {
      axios.get(`http://localhost:3000/api/history?mobile=${currentUser.mobile}&date=${selectedDate}`)
        .then(res => {
          setHistoryPoints(res.data.history);
          if (res.data.history.length === 0) {
            setError('No location history found for this date');
          } else {
            setSidebarOpen(false);
          }
        })
        .catch(err => console.error(err));
    } else {
      setHistoryPoints([]);
    }
  }, [selectedDate, currentUser]);

  // Geolocation
  useEffect(() => {
    if (step === 'map' && currentUser) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          axios.post('http://localhost:3000/api/update-location', {
            mobile: currentUser.mobile,
            lat: latitude,
            lng: longitude
          }).catch(err => console.error('Error updating location:', err));
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [step, currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (mobile.length < 1) {
      setError('Please enter a mobile number');
      return;
    }
    setError('');
    try {
      await axios.post('http://localhost:3000/api/login', { mobile });
      setStep('otp');
    } catch (err) {
      setError('Login failed.');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:3000/api/verify-otp', { mobile, otp });
      if (res.data.success) {
        const user = res.data.user;
        setCurrentUser(user);
        setStep('map');
        localStorage.setItem('tracker_user', JSON.stringify(user));
      }
    } catch (err) {
      setError('Invalid OTP');
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('tracker_user');
    setCurrentUser(null);
    setStep('login');
    setSidebarOpen(false);
    setMobile('');
    setOtp('');
  };

  if (step === 'loading') {
    return <div className="loading-spinner" style={{ marginTop: '40vh' }}></div>
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {step === 'login' && (
        <div className="login-container">
          <div className="glass-panel login-card animate-fade-in">
            <h1>🚛 Live Tracker</h1>
            <p>Enter mobile to start</p>
            <form onSubmit={handleLogin}>
              <input className="input-field" type="text" placeholder="Mobile" value={mobile} onChange={e => setMobile(e.target.value)} />
              {error && <p style={{ color: '#ef4444' }}>{error}</p>}
              <button className="btn-primary">Get OTP</button>
            </form>
          </div>
        </div>
      )}

      {step === 'otp' && (
        <div className="login-container">
          <div className="glass-panel login-card animate-fade-in">
            <h1>Verify OTP</h1>
            <p>Code sent to {mobile}</p>
            <form onSubmit={handleVerifyOtp}>
              <input className="input-field" type="text" placeholder="OTP (1234)" value={otp} onChange={e => setOtp(e.target.value)} autoFocus />
              {error && <p style={{ color: '#ef4444' }}>{error}</p>}
              <button className="btn-primary">Verify</button>
            </form>
            <button onClick={() => setStep('login')} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', marginTop: 20 }}>Back</button>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="map-container animate-fade-in">
          <button className="toggle-btn" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <h2><User size={20} /> {currentUser?.mobile}</h2>
              <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--glass-border)', padding: 6 }}><LogOut size={16} /></button>
            </div>

            <div style={{ padding: 16, borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}><Calendar size={18} /> HISTORY</div>
              <input type="date" className="input-field" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>

            <div className="sidebar-content">
              {Object.entries(groupedUsers).map(([region, regionUsers]) => (
                <div key={region} className="menu-category">
                  <div className="category-title">{region} Region</div>
                  {regionUsers.map(u => {
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    return (
                      <div key={u.mobile} className={`device-item ${isSelected ? 'active' : ''}`} onClick={() => isSelected ? setSelectedDevice(null) : setSelectedDevice(u)} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 18, height: 18, border: isSelected ? 'none' : '2px solid gray', borderRadius: 4, background: isSelected ? 'var(--primary)' : 'transparent', marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isSelected && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                        </div>
                        <Truck size={18} />
                        <span style={{ marginLeft: 8 }}>{u.mobile}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <MapComponent users={users} currentUserMobile={currentUser?.mobile} destinationUser={selectedDevice} historyPoints={historyPoints} />

          {selectedDate && (
            <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--card-bg)', padding: '8px 16px', borderRadius: 30, color: 'var(--primary)' }}>
              History: {selectedDate}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
