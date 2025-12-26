# Location Tracker Application

## Overview
A live location tracking application designed for mobile devices. Users can sign up/login with their mobile number, authenticate via OTP, and immediately start broadcasting their location to a central map. The map also displays other registered devices (e.g., trucks/fleet).

## Features
- **Mobile-First Design**: Optimized for mobile usage.
- **OTP Login**: Secure entry using mobile number and OTP.
- **Auto-Registration**: Device location and details are registered automatically upon login.
- **Live Tracking**: Real-time location updates using WebSockets.
- **Interactive Map**: Google Maps integration with dark mode/premium styling.

## Prerequisites
- Node.js installed.
- Google Maps API Key (for full map functionality).

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configuration**
    - Open `src/MapComponent.jsx`.
    - Find `googleMapsApiKey: ""` and insert your Google Maps API Key.
    - *Note: Without a key, the map will display in "Development Mode" (darkened with watermark).*

3.  **Run the Application**
    You need to run both the Backend (server) and Frontend (client).

    **Terminal 1 (Backend):**
    ```bash
    npm run server
    ```
    *Runs on port 3000.*

    **Terminal 2 (Frontend):**
    ```bash
    npm run dev
    ```
    *Runs on http://localhost:5173.*

4.  **How to Test**
    - Open `http://localhost:5173` in your browser (or use mobile network IP).
    - **Login**: Enter any 10-digit mobile number (e.g., `9000000000`).
    - **OTP**: Enter code `1234` (Mock OTP).
    - **Permission**: Allow Location Access when prompted by the browser.
    - **View**: You will see your location and 5-6 simulated trucks on the map.
