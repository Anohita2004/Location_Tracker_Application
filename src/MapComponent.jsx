import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Maximize, RotateCcw } from 'lucide-react';
import axios from 'axios';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Light theme tile layer (Clean & Minimal)
const LIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Define custom icons using L.divIcon
const createCustomIcon = (type, status, isSelected) => {
    const color = status === 'active' ? 'var(--primary)' : 'var(--text-sub)';
    const scale = isSelected ? 34 : 26;
    const zIndex = isSelected ? 1000 : 1;

    return L.divIcon({
        className: `custom-marker ${status === 'active' ? 'marker-pulse' : ''}`,
        html: `
            <div style="
                width: ${scale}px;
                height: ${scale}px;
                background: ${isSelected ? 'var(--primary)' : 'white'};
                border: 2px solid ${isSelected ? 'white' : color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            ">
                <div style="font-size: ${scale / 1.6}px; display: flex;">
                    ${type === 'me' ? '👤' : (isSelected ? '🚛' : '🚚')}
                </div>
                ${isSelected ? `<div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid var(--primary);"></div>` : ''}
            </div>
        `,
        iconSize: [scale, scale],
        iconAnchor: [scale / 2, isSelected ? scale + 8 : scale / 2],
        popupAnchor: [0, -scale],
        zIndexOffset: zIndex
    });
};

const meIcon = L.divIcon({
    className: 'custom-marker me-marker',
    html: `
        <div style="
            width: 20px;
            height: 20px;
            background: var(--primary);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px var(--primary-glow), var(--shadow-md);
        "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Calculate distance using Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const formatDistance = (km) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
};

// Component to handle map view updates
function MapController({ center, zoom, bounds }) {
    const map = useMap();

    useEffect(() => {
        if (center && zoom && !bounds) {
            map.setView(center, zoom);
        }
    }, [map, center, zoom, bounds]);

    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [100, 100] });
        }
    }, [map, bounds]);

    return null;
}

const MapComponent = ({
    users,
    currentUserMobile,
    selectedDevice,
    historyPoints = [],
    mode = 'live',
    onReset,
    onDistanceUpdate
}) => {
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);
    const [mapBounds, setMapBounds] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [routeDistance, setRouteDistance] = useState(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const mapRef = useRef(null);

    const me = useMemo(() => users.find(u => u.mobile === currentUserMobile), [users, currentUserMobile]);

    const getStatus = (lastUpdated) => {
        if (!lastUpdated) return 'offline';
        const diff = (new Date() - new Date(lastUpdated)) / 1000 / 60;
        return diff > 15 ? 'offline' : 'active';
    };

    // Decode polyline (if ORS returns encoded polyline)
    const decodePolyline = (encoded) => {
        const poly = [];
        let index = 0;
        const len = encoded.length;
        let lat = 0;
        let lng = 0;

        while (index < len) {
            let b;
            let shift = 0;
            let result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
            lng += dlng;

            poly.push([lat * 1e-5, lng * 1e-5]);
        }
        return poly;
    };

    // Fetch route from OpenRouteService or OSRM
    const fetchRoute = useCallback(async (start, end) => {
        if (!start || !end || !start.lat || !start.lng || !end.lat || !end.lng) return;

        setIsLoadingRoute(true);
        try {
            const apiKey = import.meta.env.VITE_ORS_API_KEY;
            let url;
            if (apiKey) {
                url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}&geometry=true&geometry_format=geojson`;
            } else {
                url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
            }

            const response = await axios.get(url);

            if (response.data && response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                const distance = (route.summary?.distance || route.distance) / 1000;
                setRouteDistance(distance);
                if (onDistanceUpdate) onDistanceUpdate(distance);

                let coordinates = [];
                if (route.geometry) {
                    if (route.geometry.type === 'LineString') {
                        coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    } else if (typeof route.geometry === 'string') {
                        coordinates = decodePolyline(route.geometry);
                    }
                }
                setRouteCoordinates(coordinates);
            }
        } catch (error) {
            console.error('Error fetching route:', error);
            setRouteCoordinates([[start.lat, start.lng], [end.lat, end.lng]]); // Fallback to straight line
        } finally {
            setIsLoadingRoute(false);
        }
    }, [onDistanceUpdate]);

    useEffect(() => {
        if (mode === 'nav' && me && selectedDevice) {
            fetchRoute(
                { lat: me.lat, lng: me.lng },
                { lat: selectedDevice.lat, lng: selectedDevice.lng }
            );
        } else {
            setRouteCoordinates([]);
            setRouteDistance(null);
        }
    }, [mode, me, selectedDevice, fetchRoute]);

    const handleCenterOnMe = useCallback(() => {
        if (me?.lat && me?.lng) {
            setMapCenter([me.lat, me.lng]);
            setMapZoom(14);
            setMapBounds(null);
        }
    }, [me]);

    const handleFitAll = useCallback(() => {
        const validUsers = users.filter(u => u.lat && u.lng);
        if (validUsers.length === 0) return;
        setMapBounds(validUsers.map(u => [u.lat, u.lng]));
    }, [users]);

    useEffect(() => {
        if (mode === 'live') handleFitAll();
    }, [mode, handleFitAll]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ width: '100%', height: '100%' }}
                zoomControl={false}
                ref={mapRef}
            >
                <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
                <TileLayer attribution={TILE_ATTRIBUTION} url={LIGHT_TILE_URL} />

                {users.map(u => {
                    if (!u.lat || !u.lng) return null;
                    const isMe = u.mobile === currentUserMobile;
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    const status = getStatus(u.last_updated);

                    return (
                        <Marker
                            key={u.mobile}
                            position={[u.lat, u.lng]}
                            icon={isMe ? meIcon : createCustomIcon('truck', status, isSelected)}
                        />
                    );
                })}

                {mode === 'nav' && routeCoordinates.length > 0 && (
                    <Polyline
                        positions={routeCoordinates}
                        pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.8 }}
                    />
                )}

                {mode === 'history' && historyPoints.length > 1 && (
                    <>
                        <Polyline
                            positions={historyPoints.map(p => [p.lat, p.lng])}
                            pathOptions={{ color: '#10b981', weight: 5, opacity: 0.8 }}
                        />
                        <Marker position={[historyPoints[0].lat, historyPoints[0].lng]} icon={createCustomIcon('start', 'active', false)} />
                        <Marker position={[historyPoints[historyPoints.length - 1].lat, historyPoints[historyPoints.length - 1].lng]} icon={createCustomIcon('end', 'active', false)} />
                    </>
                )}
            </MapContainer>

            {routeDistance && mode === 'nav' && (
                <div style={{
                    position: 'absolute', top: 20, right: 20, background: 'rgba(15, 23, 42, 0.9)',
                    padding: '12px 16px', borderRadius: '12px', color: 'white', zIndex: 10
                }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>DISTANCE</div>
                    <div>{formatDistance(routeDistance)}</div>
                </div>
            )}

            <div className="floating-controls">
                <button className="fab glass" onClick={handleCenterOnMe}><Crosshair size={24} color="#3b82f6" /></button>
                <button className="fab glass" onClick={handleFitAll}><Maximize size={24} color="#94a3b8" /></button>
                <button className="fab glass" onClick={onReset}><RotateCcw size={24} color="#94a3b8" /></button>
            </div>
        </div>
    );
};

export default React.memo(MapComponent);
