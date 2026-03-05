import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../services/api';

export const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("Task Manager Error: ", error);
        return;
    }
    if (data) {
        const { locations } = data;
        try {
            const userStr = await AsyncStorage.getItem('tracker_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (locations && locations.length > 0) {
                    const location = locations[0];
                    await axios.post(`${baseURL}/api/update-location`, {
                        mobile: user.mobile,
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                    });
                    console.log(`[Background] Sent location for ${user.mobile} at ${new Date().toISOString()}`);
                }
            }
        } catch (e) {
            console.error("[Background] Failed to send location: ", e);
        }
    }
});
