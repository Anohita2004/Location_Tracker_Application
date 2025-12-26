import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '100%'
};

const center = {
    lat: 20.5937,
    lng: 78.9629
};

const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

function MapComponent({ users, currentUserMobile, destinationUser, historyPoints = [] }) {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: ""
    });

    const [map, setMap] = React.useState(null);

    const onLoad = React.useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = React.useCallback(function callback(map) {
        setMap(null);
    }, []);

    // Center on user: Initially, OR when navigation/history is cleared
    useEffect(() => {
        // Only center if NO destination and NO history is active
        if (map && currentUserMobile && !destinationUser && users.length > 0 && historyPoints.length === 0) {
            const currentUser = users.find(u => u.mobile === currentUserMobile);
            if (currentUser?.lat) {
                map.panTo({ lat: currentUser.lat, lng: currentUser.lng });
                // Reset zoom to street level (15) to "unview" the route view
                map.setZoom(15);
            }
        }
    }, [users, currentUserMobile, map, destinationUser, historyPoints]);

    // Fit bounds if route active or history
    useEffect(() => {
        if (map && historyPoints.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            historyPoints.forEach(pt => bounds.extend({ lat: pt.lat, lng: pt.lng }));
            map.fitBounds(bounds);
        } else if (map && currentUserMobile && destinationUser && users.length > 0) {
            const currentUser = users.find(u => u.mobile === currentUserMobile);
            if (currentUser?.lat && destinationUser?.lat) {
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend({ lat: currentUser.lat, lng: currentUser.lng });
                bounds.extend({ lat: destinationUser.lat, lng: destinationUser.lng });
                map.fitBounds(bounds);
            }
        }
    }, [destinationUser, currentUserMobile, users, map, historyPoints]);

    if (!isLoaded) return <div className="loading-spinner"></div>;

    const currentUser = users.find(u => u.mobile === currentUserMobile);
    const routePath = (currentUser && destinationUser) ? [
        { lat: currentUser.lat, lng: currentUser.lng },
        { lat: destinationUser.lat, lng: destinationUser.lng }
    ] : [];

    // Convert history points to path
    const historyPath = historyPoints.map(pt => ({ lat: pt.lat, lng: pt.lng }));

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={5}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
                styles: darkMapStyle,
                disableDefaultUI: false,
                zoomControl: true,
            }}
        >
            {/* Live Users - Other Trucks */}
            {historyPoints.length === 0 && users.map(user => {
                if (!user.lat || !user.lng) return null;
                // Don't render "Me" here, I'll do it separately to be safe and clear
                if (user.mobile === currentUserMobile) return null;

                const isDestination = destinationUser?.mobile === user.mobile;

                return (
                    <Marker
                        key={user.mobile}
                        position={{ lat: user.lat, lng: user.lng }}
                        title={`User: ${user.mobile}`}
                        label={{
                            text: isDestination ? "🎯" : "🚛",
                            color: "white",
                            fontSize: "14px"
                        }}
                    />
                )
            })}

            {/* Current User Marker - Always Show if Location Available */}
            {(() => {
                const me = users.find(u => u.mobile === currentUserMobile);
                if (me && me.lat && me.lng && historyPoints.length === 0) {
                    return (
                        <Marker
                            position={{ lat: me.lat, lng: me.lng }}
                            title="Me"
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
                    )
                }
                return null;
            })()}

            {/* Route Line - only if destination is picked and has coordinates */}
            {destinationUser && currentUser && currentUser.lat && destinationUser.lat && (
                <Polyline
                    key={`route-line-${destinationUser.mobile}`}
                    path={[
                        { lat: currentUser.lat, lng: currentUser.lng },
                        { lat: destinationUser.lat, lng: destinationUser.lng }
                    ]}
                    options={{
                        strokeColor: "#3b82f6",
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        geodesic: true,
                        icons: [{
                            icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                            offset: '100%'
                        }]
                    }}
                />
            )}

            {/* History Path */}
            {historyPath.length > 0 && (
                <>
                    <Polyline
                        path={historyPath}
                        options={{
                            strokeColor: "#10b981", // Green for history
                            strokeOpacity: 0.8,
                            strokeWeight: 4,
                        }}
                    />
                    {historyPoints.map((pt, i) => (
                        <Marker
                            key={i}
                            position={{ lat: pt.lat, lng: pt.lng }}
                            options={{
                                icon: {
                                    path: window.google.maps.SymbolPath.CIRCLE,
                                    scale: 5,
                                    fillColor: "#10b981",
                                    fillOpacity: 1,
                                    strokeColor: "white",
                                    strokeWeight: 1,
                                }
                            }}
                        />
                    ))}
                </>
            )}
        </GoogleMap>
    )
}

export default React.memo(MapComponent)
