import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socket } from '../services/api';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';

export default function MapScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [locationError, setLocationError] = useState('');
    const [isTransmitting, setIsTransmitting] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('tracker_user').then(u => {
            if (u) setUser(JSON.parse(u));
            else navigation.replace('Login');
        });
    }, []);

    useEffect(() => {
        if (!user) return;

        // Listen for sockets
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

        startBackgroundTracking();

        return () => {
            socket.off('initial-data');
            socket.off('location-update');
            Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => { });
        };
    }, [user]);

    const startBackgroundTracking = async () => {
        try {
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') {
                setLocationError('Foreground permission to access location was denied');
                return;
            }

            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                setLocationError('Background permission to access location was denied');
                return;
            }

            const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (!isRegistered) {
                await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                    accuracy: Location.Accuracy.High,
                    showsBackgroundLocationIndicator: true,
                    distanceInterval: 10,
                    deferredUpdatesInterval: 5000,
                    foregroundService: {
                        notificationTitle: "FleetOps Tracking",
                        notificationBody: "Location is tracking in the background.",
                        notificationColor: "#3b82f6",
                    },
                });
            }
            setIsTransmitting(true);
        } catch (err) {
            console.log(err);
            setLocationError(err.message);
        }
    };

    const currentUserData = user ? users.find(u => u.mobile === user.mobile) : null;
    const hasLocation = currentUserData && currentUserData.lat && currentUserData.lng;

    const mapRegion = hasLocation ? {
        latitude: currentUserData.lat,
        longitude: currentUserData.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    } : {
        latitude: 28.6139,
        longitude: 77.2090,
        latitudeDelta: 10,
        longitudeDelta: 10,
    };

    return (
        <View style={styles.container}>
            <MapView style={styles.map} initialRegion={mapRegion} showsUserLocation>
                {users.filter(u => u.lat && u.lng).map((u) => (
                    <Marker
                        key={u.mobile}
                        coordinate={{ latitude: u.lat, longitude: u.lng }}
                        title={u.mobile}
                        description={u.last_updated ? new Date(u.last_updated).toLocaleTimeString() : 'Unknown'}
                        pinColor={u.mobile === user?.mobile ? 'green' : 'red'}
                    />
                ))}
            </MapView>

            <View style={styles.overlayText}>
                <Text style={styles.transmittingText}>
                    {isTransmitting ? '🟢 GPS BROADCASTING' : '🔴 GPS OFFLINE'}
                </Text>
                {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    map: { width: '100%', height: '100%' },
    overlayText: {
        position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(15,23,42,0.8)', padding: 10, borderRadius: 20
    },
    transmittingText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    errorText: { color: 'red', fontSize: 10, marginTop: 5 }
});
