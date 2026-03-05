import { io } from 'socket.io-client';

// Change this to your machine's IP address on the local network
const API_URL = 'http://192.168.29.61:3000';
export const socket = io(API_URL);
export const baseURL = API_URL;
