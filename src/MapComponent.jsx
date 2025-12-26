import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { Crosshair, Maximize, RotateCcw } from 'lucide-react';

const containerStyle = { width: '100%', height: '100%' };

const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] }
];

const MapComponent = ({
    users,
    currentUserMobile,
    selectedDevice,
    historyPoints = [],
    mode = 'live',
    onReset
}) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
    });

    const [map, setMap] = useState(null);

    const me = useMemo(() => users.find(u => u.mobile === currentUserMobile), [users, currentUserMobile]);

    const getStatus = (lastUpdated) => {
        if (!lastUpdated) return 'offline';
        const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60;
        return diff > 15 ? 'offline' : 'active';
    };

    const handleCenterOnMe = useCallback(() => {
        if (map && me?.lat) {
            map.panTo({ lat: me.lat, lng: me.lng });
            map.setZoom(14);
        }
    }, [map, me]);

    const handleFitAll = useCallback(() => {
        if (!map || users.length === 0) return;
        const bounds = new window.google.maps.LatLngBounds();
        let hasCoords = false;
        users.forEach(u => {
            if (u.lat && u.lng) {
                bounds.extend({ lat: u.lat, lng: u.lng });
                hasCoords = true;
            }
        });
        if (hasCoords) map.fitBounds(bounds, { top: 100, bottom: 200, left: 100, right: 100 });
    }, [map, users]);

    useEffect(() => {
        if (mode === 'live' && map) handleFitAll();
    }, [mode, map, handleFitAll]);

    useEffect(() => {
        if (mode === 'nav' && map && me && selectedDevice) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: me.lat, lng: me.lng });
            bounds.extend({ lat: selectedDevice.lat, lng: selectedDevice.lng });
            map.fitBounds(bounds, { top: 100, bottom: 300, left: 100, right: 100 });
        }
    }, [mode, map, me, selectedDevice]);

    if (!isLoaded) return <div className="login-screen"><div className="pulse-me"></div></div>;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={me ? { lat: me.lat, lng: me.lng } : { lat: 20.5937, lng: 78.9629 }}
                zoom={me ? 12 : 5}
                onLoad={setMap}
                onUnmount={() => setMap(null)}
                options={{
                    styles: darkMapStyle,
                    disableDefaultUI: true,
                    clickableIcons: false
                }}
            >
                {users.map(u => {
                    if (!u.lat || !u.lng) return null;
                    const isMe = u.mobile === currentUserMobile;
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    const status = getStatus(u.last_updated);

                    if (isMe) {
                        return (
                            <Marker
                                key="me"
                                position={{ lat: u.lat, lng: u.lng }}
                                icon={{
                                    path: window.google.maps.SymbolPath.CIRCLE,
                                    scale: 12,
                                    fillColor: "#3b82f6",
                                    fillOpacity: 1,
                                    strokeColor: "white",
                                    strokeWeight: 3,
                                }}
                            />
                        );
                    }

                    return (
                        <Marker
                            key={u.mobile}
                            position={{ lat: u.lat, lng: u.lng }}
                            options={{
                                opacity: status === 'offline' ? 0.6 : 1,
                                label: {
                                    text: isSelected ? "🎯" : "🚛",
                                    color: "white",
                                    fontSize: "14px",
                                    fontWeight: "bold"
                                },
                                icon: {
                                    url: isSelected ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                    scaledSize: isSelected ? new window.google.maps.Size(40, 40) : new window.google.maps.Size(32, 32)
                                }
                            }}
                        />
                    );
                })}

                {mode === 'nav' && me && selectedDevice && (
                    <Polyline
                        path={[{ lat: me.lat, lng: me.lng }, { lat: selectedDevice.lat, lng: selectedDevice.lng }]}
                        options={{
                            strokeColor: "#3b82f6",
                            strokeOpacity: 0.9,
                            strokeWeight: 5,
                            geodesic: true
                        }}
                    />
                )}

                {mode === 'history' && historyPoints.length > 0 && (
                    <>
                        <Polyline
                            path={historyPoints.map(p => ({ lat: p.lat, lng: p.lng }))}
                            options={{ strokeColor: "#10b981", strokeWeight: 5, strokeOpacity: 0.8 }}
                        />
                        <Marker position={{ lat: historyPoints[0].lat, lng: historyPoints[0].lng }} label="A" />
                        <Marker position={{ lat: historyPoints[historyPoints.length - 1].lat, lng: historyPoints[historyPoints.length - 1].lng }} label="B" />
                    </>
                )}
            </GoogleMap>

            <div className="floating-controls">
                <button className="fab glass" onClick={handleCenterOnMe}>
                    <Crosshair size={24} color="var(--primary)" />
                </button>
                <button className="fab glass" onClick={handleFitAll}>
                    <Maximize size={24} color="var(--text-sub)" />
                </button>
                <button className="fab glass" onClick={onReset}>
                    <RotateCcw size={24} color="var(--text-sub)" />
                </button>
            </div>
        </div>
    );
};

export default React.memo(MapComponent);
