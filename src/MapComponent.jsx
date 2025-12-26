import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { Crosshair, Maximize, RotateCcw } from 'lucide-react';

const containerStyle = { width: '100%', height: '100%' };

// Dark Mode Style
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] }
];

const MapComponent = ({
    users,
    currentUserMobile,
    selectedDevice,
    historyPoints = [],
    mode = 'live',
    onReset
}) => {
    const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: "" });
    const [map, setMap] = useState(null);

    const onLoad = useCallback(m => setMap(m), []);
    const onUnmount = useCallback(() => setMap(null), []);

    const me = useMemo(() => users.find(u => u.mobile === currentUserMobile), [users, currentUserMobile]);

    // Status Logic
    const getStatus = (lastUpdated) => {
        if (!lastUpdated) return 'offline';
        const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60; // minutes
        if (diff > 15) return 'offline';
        return 'active'; // In real app, check movement for 'idle'
    };

    // Center on Me / Fit All Logic
    const handleCenterOnMe = () => {
        if (map && me?.lat) {
            map.panTo({ lat: me.lat, lng: me.lng });
            map.setZoom(15);
        }
    };

    const handleFitAll = () => {
        if (!map || users.length === 0) return;
        const bounds = new window.google.maps.LatLngBounds();
        users.forEach(u => {
            if (u.lat && u.lng) bounds.extend({ lat: u.lat, lng: u.lng });
        });
        map.fitBounds(bounds);
    };

    // Auto-center when mode changes
    useEffect(() => {
        if (mode === 'live' && map) handleFitAll();
    }, [mode, map]);

    useEffect(() => {
        if (mode === 'nav' && map && me && selectedDevice) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: me.lat, lng: me.lng });
            bounds.extend({ lat: selectedDevice.lat, lng: selectedDevice.lng });
            map.fitBounds(bounds, { top: 50, bottom: 250, left: 50, right: 50 });
        }
    }, [mode, map, me, selectedDevice]);

    if (!isLoaded) return null;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={{ lat: 20.5937, lng: 78.9629 }}
                zoom={5}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{ styles: darkMapStyle, disableDefaultUI: true }}
            >
                {/* Render Users */}
                {users.map(u => {
                    if (!u.lat || !u.lng) return null;
                    const isMe = u.mobile === currentUserMobile;
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    const status = getStatus(u.last_updated);

                    // Me Marker
                    if (isMe) {
                        return (
                            <Marker
                                key="me"
                                position={{ lat: u.lat, lng: u.lng }}
                                options={{
                                    icon: {
                                        path: window.google.maps.SymbolPath.CIRCLE,
                                        scale: 10,
                                        fillColor: "#3b82f6",
                                        fillOpacity: 1,
                                        strokeColor: "white",
                                        strokeWeight: 2,
                                    }
                                }}
                            />
                        );
                    }

                    // Device Marker
                    return (
                        <Marker
                            key={u.mobile}
                            position={{ lat: u.lat, lng: u.lng }}
                            options={{
                                opacity: status === 'offline' ? 0.5 : 1,
                                label: {
                                    text: isSelected ? "🎯" : "🚛",
                                    color: "white",
                                    fontSize: "14px",
                                    className: "map-marker-label"
                                }
                            }}
                        />
                    );
                })}

                {/* Navigation Mode Polyline */}
                {mode === 'nav' && me && selectedDevice && (
                    <Polyline
                        path={[{ lat: me.lat, lng: me.lng }, { lat: selectedDevice.lat, lng: selectedDevice.lng }]}
                        options={{
                            strokeColor: "#3b82f6",
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                            geodesic: true
                        }}
                    />
                )}

                {/* History Mode Elements */}
                {mode === 'history' && historyPoints.length > 0 && (
                    <>
                        <Polyline
                            path={historyPoints.map(p => ({ lat: p.lat, lng: p.lng }))}
                            options={{ strokeColor: "#10b981", strokeWeight: 4 }}
                        />
                        {/* Start Marker */}
                        <Marker
                            position={{ lat: historyPoints[0].lat, lng: historyPoints[0].lng }}
                            label="START"
                        />
                        {/* End Marker */}
                        <Marker
                            position={{ lat: historyPoints[historyPoints.length - 1].lat, lng: historyPoints[historyPoints.length - 1].lng }}
                            label="END"
                        />
                    </>
                )}
            </GoogleMap>

            {/* Floating Map Controls */}
            <div className="floating-controls">
                <button className="fab glass" onClick={handleCenterOnMe} title="Center on Me">
                    <Crosshair size={24} color="var(--primary)" />
                </button>
                <button className="fab glass" onClick={handleFitAll} title="Fit All Trucks">
                    <Maximize size={24} color="var(--text-sub)" />
                </button>
                <button className="fab glass" onClick={onReset} title="Reset View">
                    <RotateCcw size={24} color="var(--text-sub)" />
                </button>
            </div>
        </div>
    );
};

export default React.memo(MapComponent);
