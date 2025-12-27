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

// Dark theme tile layer - Using OpenStreetMap with dark styling
// Alternative: CartoDB Dark Matter (if CORS issues, use OSM)
const DARK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Fallback dark tile (if OSM doesn't work)
// const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// Calculate distance using Haversine formula (straight line)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Format distance for display
const formatDistance = (km) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
};

// Component to handle map view updates
function MapController({ center, zoom, bounds }) {
    const map = useMap();
    
    useEffect(() => {
        if (center && zoom) {
            map.setView(center, zoom);
        }
    }, [map, center, zoom]);

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

    // Fetch route from OpenRouteService API
    const fetchRoute = useCallback(async (start, end) => {
        if (!start || !end || !start.lat || !start.lng || !end.lat || !end.lng) {
            console.error('Invalid start or end coordinates');
            return;
        }

        setIsLoadingRoute(true);
        try {
            // OpenRouteService Directions API
            // Get free API key from https://openrouteservice.org/dev/#/signup
            const apiKey = import.meta.env.VITE_ORS_API_KEY || '';
            
            // Build the URL with proper parameters
            let url;
            if (apiKey) {
                // With API key - use full features
                url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}&geometry=true&geometry_format=geojson`;
            } else {
                // Try without API key (may have rate limits)
                url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${start.lng},${start.lat}&end=${end.lng},${end.lat}&geometry=true&geometry_format=geojson`;
            }
            
            console.log('Fetching route from OpenRouteService...');
            const response = await axios.get(url, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                }
            });
            
            if (response.data && response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                const distance = route.summary.distance / 1000; // Convert meters to kilometers
                setRouteDistance(distance);
                if (onDistanceUpdate) onDistanceUpdate(distance);
                
                // Extract coordinates from the route geometry
                let coordinates = [];
                
                if (route.geometry) {
                    if (route.geometry.type === 'LineString' && Array.isArray(route.geometry.coordinates)) {
                        // GeoJSON format: coordinates are [lng, lat]
                        coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    } else if (typeof route.geometry === 'string') {
                        // Encoded polyline - decode it
                        coordinates = decodePolyline(route.geometry).map(coord => [coord[0], coord[1]]);
                    }
                }
                
                if (coordinates.length > 0) {
                    setRouteCoordinates(coordinates);
                    console.log('Route fetched successfully:', coordinates.length, 'points');
                } else {
                    throw new Error('No coordinates in route geometry');
                }
            } else {
                throw new Error('No routes returned from API');
            }
        } catch (error) {
            console.error('Error fetching route from OpenRouteService:', error);
            
            // Try alternative: OSRM (Open Source Routing Machine) - free, no API key needed
            try {
                console.log('Trying OSRM as fallback...');
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
                const osrmResponse = await axios.get(osrmUrl, { timeout: 10000 });
                
                if (osrmResponse.data && osrmResponse.data.routes && osrmResponse.data.routes.length > 0) {
                    const route = osrmResponse.data.routes[0];
                    const distance = route.distance / 1000; // Convert meters to kilometers
                    setRouteDistance(distance);
                    if (onDistanceUpdate) onDistanceUpdate(distance);
                    
                    // OSRM returns GeoJSON format
                    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    setRouteCoordinates(coordinates);
                    console.log('Route fetched from OSRM successfully:', coordinates.length, 'points');
                } else {
                    throw new Error('OSRM returned no routes');
                }
            } catch (osrmError) {
                console.error('OSRM also failed:', osrmError);
                // Last resort: show error message but don't use straight line
                setMapError('Unable to fetch road route. Please check your internet connection or add an OpenRouteService API key.');
                setRouteCoordinates([]);
                setRouteDistance(null);
            }
        } finally {
            setIsLoadingRoute(false);
        }
    }, [onDistanceUpdate]);

    // Fetch route when in nav mode
    useEffect(() => {
        if (mode === 'nav' && me && selectedDevice && me.lat && me.lng && selectedDevice.lat && selectedDevice.lng) {
            fetchRoute(
                { lat: me.lat, lng: me.lng },
                { lat: selectedDevice.lat, lng: selectedDevice.lng }
            );
        } else {
            setRouteCoordinates([]);
            setRouteDistance(null);
        }
    }, [mode, me, selectedDevice, fetchRoute]);

    // Calculate distance for history path
    useEffect(() => {
        if (mode === 'history' && historyPoints.length > 1) {
            let totalDistance = 0;
            for (let i = 0; i < historyPoints.length - 1; i++) {
                totalDistance += calculateDistance(
                    historyPoints[i].lat,
                    historyPoints[i].lng,
                    historyPoints[i + 1].lat,
                    historyPoints[i + 1].lng
                );
            }
            if (onDistanceUpdate) onDistanceUpdate(totalDistance);
        }
    }, [mode, historyPoints, onDistanceUpdate]);

    const handleCenterOnMe = useCallback(() => {
        if (me?.lat && me?.lng) {
            setMapCenter([me.lat, me.lng]);
            setMapZoom(14);
            setMapBounds(null);
        }
    }, [me]);

    const handleFitAll = useCallback(() => {
        if (users.length === 0) return;
        
        const validUsers = users.filter(u => u.lat && u.lng);
        if (validUsers.length === 0) return;

        const bounds = validUsers.map(u => [u.lat, u.lng]);
        setMapBounds(bounds);
    }, [users]);

    useEffect(() => {
        if (mode === 'live') {
            handleFitAll();
        }
    }, [mode, handleFitAll]);

    useEffect(() => {
        if (mode === 'nav' && me && selectedDevice) {
            const bounds = [
                [me.lat, me.lng],
                [selectedDevice.lat, selectedDevice.lng]
            ];
            setMapBounds(bounds);
        }
    }, [mode, me, selectedDevice]);

    // Update initial view when user location is available
    useEffect(() => {
        if (me?.lat && me?.lng && mapCenter[0] === 20.5937) {
            setMapCenter([me.lat, me.lng]);
            setMapZoom(12);
        }
    }, [me, mapCenter]);

    // Custom marker icon creator
    const createCustomIcon = (isMe, isSelected, status) => {
        const size = isMe ? 24 : isSelected ? 40 : 32;
        const color = isMe ? '#3b82f6' : isSelected ? '#3b82f6' : '#ef4444';
        const opacity = status === 'offline' ? 0.6 : 1;

        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background-color: ${color};
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isMe ? '12px' : '16px'};
                opacity: ${opacity};
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">${!isMe && (isSelected ? '🎯' : '🚛')}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    };

    // Add error boundary and loading state
    const [mapError, setMapError] = useState(null);
    const [mapReady, setMapReady] = useState(false);
    const mapContainerRef = useRef(null);
    const isMapInitialized = useRef(false);

    useEffect(() => {
        console.log('MapComponent rendered', { mapCenter, mapZoom, users: users.length });
    }, [mapCenter, mapZoom, users]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                isMapInitialized.current = false;
            }
        };
    }, []);

    return (
        <div 
            ref={mapContainerRef}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', background: '#0f172a', zIndex: 0 }}
        >
            {mapError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    zIndex: 1000
                }}>
                    Map Error: {mapError}
                </div>
            )}
            {!mapReady && !isMapInitialized.current && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    zIndex: 1000
                }}>
                    Loading map...
                </div>
            )}
            <MapContainer
                key="main-map-container"
                center={mapCenter}
                zoom={mapZoom}
                style={{ width: '100%', height: '100%', minHeight: '400px' }}
                zoomControl={true}
                whenCreated={(mapInstance) => {
                    if (!isMapInitialized.current && mapInstance) {
                        mapRef.current = mapInstance;
                        isMapInitialized.current = true;
                        setMapReady(true);
                        console.log('Map created successfully:', mapInstance);
                    }
                }}
                scrollWheelZoom={true}
            >
                <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
                
                <TileLayer
                    attribution={DARK_TILE_ATTRIBUTION}
                    url={DARK_TILE_URL}
                    maxZoom={19}
                    minZoom={1}
                />

                {/* User Markers */}
                {users.map(u => {
                    if (!u.lat || !u.lng) return null;
                    const isMe = u.mobile === currentUserMobile;
                    const isSelected = selectedDevice?.mobile === u.mobile;
                    const status = getStatus(u.last_updated);

                    return (
                        <Marker
                            key={u.mobile}
                            position={[u.lat, u.lng]}
                            icon={createCustomIcon(isMe, isSelected, status)}
                        />
                    );
                })}

                {/* Navigation Route */}
                {mode === 'nav' && routeCoordinates.length > 0 && (
                    <Polyline
                        positions={routeCoordinates}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 5,
                            opacity: 0.9
                        }}
                    />
                )}

                {/* History Path */}
                {mode === 'history' && historyPoints.length > 1 && (
                    <Polyline
                        positions={historyPoints.map(p => [p.lat, p.lng])}
                        pathOptions={{
                            color: '#10b981',
                            weight: 5,
                            opacity: 0.8
                        }}
                    />
                )}

                {/* History Start/End Markers */}
                {mode === 'history' && historyPoints.length > 0 && (
                    <>
                        <Marker
                            position={[historyPoints[0].lat, historyPoints[0].lng]}
                            icon={L.divIcon({
                                className: 'history-marker',
                                html: `<div style="
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 50%;
                                    background-color: #10b981;
                                    border: 3px solid white;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-weight: bold;
                                    font-size: 14px;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                ">A</div>`,
                                iconSize: [32, 32],
                                iconAnchor: [16, 16]
                            })}
                        />
                        {historyPoints.length > 1 && (
                            <Marker
                                position={[historyPoints[historyPoints.length - 1].lat, historyPoints[historyPoints.length - 1].lng]}
                                icon={L.divIcon({
                                    className: 'history-marker',
                                    html: `<div style="
                                        width: 32px;
                                        height: 32px;
                                        border-radius: 50%;
                                        background-color: #10b981;
                                        border: 3px solid white;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: white;
                                        font-weight: bold;
                                        font-size: 14px;
                                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                                    ">B</div>`,
                                    iconSize: [32, 32],
                                    iconAnchor: [16, 16]
                                })}
                            />
                        )}
                    </>
                )}
            </MapContainer>

            {/* Distance Display */}
            {routeDistance && mode === 'nav' && (
                <div style={{
                    position: 'absolute',
                    top: 80,
                    right: 20,
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(10px)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginBottom: 4 }}>DISTANCE</div>
                    <div>{formatDistance(routeDistance)}</div>
                    {isLoadingRoute && <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: 4 }}>Calculating route...</div>}
                </div>
            )}

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
