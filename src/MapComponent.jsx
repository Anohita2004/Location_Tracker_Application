import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Maximize, RotateCcw } from 'lucide-react';

// Define custom icons using L.divIcon to match previous aesthetic
const createCustomIcon = (type, status, isSelected) => {
    const color = status === 'active' ? '#10b981' : '#64748b';
    const borderColor = isSelected ? '#f59e0b' : 'white';
    const scale = isSelected ? 40 : 32;
    const border = isSelected ? 3 : 2;
    const zIndex = isSelected ? 1000 : 1;

    // Pulse effect for active markers
    const pulseClass = status === 'active' ? 'marker-pulse' : '';

    return L.divIcon({
        className: `custom-marker ${pulseClass}`,
        html: `
            <div style="
                width: ${scale}px;
                height: ${scale}px;
                background-color: ${color};
                border: ${border}px solid ${borderColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            ">
                <span style="font-size: ${scale / 2}px;">${type === 'me' ? '🔵' : '🚛'}</span>
            </div>
            ${isSelected ? `<div class="marker-label" style="
                position: absolute;
                bottom: -25px;
                left: 50%;
                transform: translateX(-50%);
                background: #1e293b;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                white-space: nowrap;
            ">Selected</div>` : ''}
        `,
        iconSize: [scale, scale],
        iconAnchor: [scale / 2, scale / 2],
        popupAnchor: [0, -scale / 2],
        zIndexOffset: zIndex
    });
};

const meIcon = L.divIcon({
    className: 'custom-marker me-marker',
    html: `
        <div style="
            width: 24px;
            height: 24px;
            background-color: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
        "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// Component to handle map movements (similar to effects in previous version)
const MapController = ({ mode, users, me, selectedDevice, onFitAll, hasInitialFit }) => {
    const map = useMap();

    // Handle Initial Fit / Mode Fit
    useEffect(() => {
        if (mode === 'live' && users.length > 0 && !hasInitialFit.current) {
            // Fit bounds of all users
            const group = L.featureGroup(users.map(u => L.marker([u.lat, u.lng])));
            // If valid bounds
            if (group.getBounds().isValid()) {
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
                hasInitialFit.current = true;
            }
        }
    }, [mode, users.length, map, hasInitialFit]); // Depend on length to trigger when data arrives

    // Handle Nav Fit
    useEffect(() => {
        if (mode === 'nav' && me && selectedDevice) {
            const group = L.featureGroup([
                L.marker([me.lat, me.lng]),
                L.marker([selectedDevice.lat, selectedDevice.lng])
            ]);
            if (group.getBounds().isValid()) {
                map.fitBounds(group.getBounds(), { padding: [100, 100] });
            }
        }
    }, [mode, me, selectedDevice, map]);

    return null;
};

const MapComponent = ({
    users,
    currentUserMobile,
    selectedDevice,
    historyPoints = [],
    mode = 'live',
    onReset
}) => {
    const mapRef = useRef(null);
    const hasInitialFit = useRef(false);

    const me = users.find(u => u.mobile === currentUserMobile);

    const getStatus = (lastUpdated) => {
        if (!lastUpdated) return 'offline';
        const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60;
        return diff > 15 ? 'offline' : 'active';
    };

    const handleCenterOnMe = () => {
        if (mapRef.current && me) {
            mapRef.current.flyTo([me.lat, me.lng], 15);
        }
    };

    const handleFitAll = () => {
        if (mapRef.current && users.length > 0) {
            const validUsers = users.filter(u => u.lat && u.lng);
            if (validUsers.length === 0) return;
            const group = L.featureGroup(validUsers.map(u => L.marker([u.lat, u.lng])));
            if (group.getBounds().isValid()) {
                mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        }
    };

    // Reset initial fit when mode changes back to live
    useEffect(() => {
        if (mode !== 'live') hasInitialFit.current = false;
    }, [mode]);

    // Default center (India)
    const defaultCenter = [20.5937, 78.9629];
    const initialCenter = me ? [me.lat, me.lng] : defaultCenter;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
            <MapContainer
                center={initialCenter}
                zoom={5}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
                zoomControl={false}
                ref={mapRef}
            >
                {/* 
                    Tile Layer Options:
                    1. OpenStreetMap (Standard): 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    2. CartoDB Dark Matter: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    3. Esri World Imagery (Satellite): 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    
                    User asked for "Detailed". Standard OSM is best for street detail.
                    But to keep it premium, dark mode is nice. 
                    Let's use a high-contrast OSM style or CartoDB Voyager.
                    Actually, let's use the Standard OSM because it IS detailed.
                */}
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController
                    mode={mode}
                    users={users}
                    me={me}
                    selectedDevice={selectedDevice}
                    onFitAll={handleFitAll}
                    hasInitialFit={hasInitialFit}
                />

                {users.map(u => {
                    if (!u.lat || !u.lng) return null;
                    const isMe = u.mobile === currentUserMobile;
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    const status = getStatus(u.last_updated);

                    if (isMe) {
                        return (
                            <Marker
                                key="me"
                                position={[u.lat, u.lng]}
                                icon={meIcon}
                            />
                        );
                    }

                    return (
                        <Marker
                            key={u.mobile}
                            position={[u.lat, u.lng]}
                            icon={createCustomIcon('truck', status, isSelected)}
                            eventHandlers={{
                                click: () => {
                                    // Normally we'd callback to App to select, but App handles selection via sidebar mostly.
                                    // We can add an onSelect prop if needed, but for now just visual.
                                }
                            }}
                        >
                            {/* Optional Popup */}
                        </Marker>
                    );
                })}

                {mode === 'nav' && me && selectedDevice && (
                    <Polyline
                        positions={[[me.lat, me.lng], [selectedDevice.lat, selectedDevice.lng]]}
                        pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.8 }}
                    />
                )}

                {mode === 'history' && historyPoints.length > 0 && (
                    <>
                        <Polyline
                            positions={historyPoints.map(p => [p.lat, p.lng])}
                            pathOptions={{ color: '#10b981', weight: 4 }}
                        />
                        <Marker position={[historyPoints[0].lat, historyPoints[0].lng]} icon={createCustomIcon('start', 'active', false)} />
                        <Marker position={[historyPoints[historyPoints.length - 1].lat, historyPoints[historyPoints.length - 1].lng]} icon={createCustomIcon('end', 'active', false)} />
                    </>
                )}

            </MapContainer>

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
