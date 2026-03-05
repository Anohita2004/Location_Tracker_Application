import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../services/api';

export default function LoginScreen({ navigation }) {
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('login');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!mobile) {
            setError('Enter mobile');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await axios.post(`${baseURL}/api/login`, { mobile });
            setStep('otp');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${baseURL}/api/verify-otp`, { mobile, otp });
            if (res.data.success) {
                await AsyncStorage.setItem('tracker_user', JSON.stringify(res.data.user));
                navigation.replace('Map');
            }
        } catch {
            setError('Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🚛</Text>
            <Text style={styles.title}>FleetOps</Text>
            <Text style={styles.subtitle}>Real-time Asset Intelligence</Text>

            <View style={styles.card}>
                <Text style={styles.label}>{step === 'login' ? 'MOBILE' : 'OTP'}</Text>
                <TextInput
                    style={styles.input}
                    value={step === 'login' ? mobile : otp}
                    onChangeText={step === 'login' ? setMobile : setOtp}
                    placeholder={step === 'login' ? "Mobile Number" : "1234"}
                    keyboardType={step === 'login' ? "phone-pad" : "number-pad"}
                    autoCapitalize="none"
                />
                {step === 'otp' && <Text style={styles.helptxt}>Test Code: 1234</Text>}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity style={styles.btn} onPress={step === 'login' ? handleLogin : handleVerify} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{step === 'login' ? "Get Started" : "Verify"}</Text>}
                </TouchableOpacity>

                <View style={styles.debug}>
                    <Text style={styles.debugText}>Target Server: {baseURL}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20
    },
    icon: { fontSize: 50, marginBottom: 10 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    subtitle: { color: '#94a3b8', fontSize: 16, marginBottom: 40 },
    card: {
        width: '100%', backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    label: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
    input: {
        backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    helptxt: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
    error: { color: '#ef4444', marginBottom: 15, fontSize: 14 },
    btn: { backgroundColor: '#3b82f6', padding: 15, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    debug: { marginTop: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 },
    debugText: { color: '#94a3b8', fontSize: 12 }
});
