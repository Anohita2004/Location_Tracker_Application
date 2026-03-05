import { io } from 'socket.io-client';

// Change this to your machine's IP address on the local network
// Production Render URL
const API_URL = 'https://location-tracker-k3hg.onrender.com';
export const socket = io(API_URL);
export const baseURL = API_URL;
