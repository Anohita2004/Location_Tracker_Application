# Location Tracker Application

## Overview
A live location tracking application designed for mobile devices. Users can sign up/login with their mobile number, authenticate via OTP, and immediately start broadcasting their location to a central map. The map also displays other registered devices (e.g., trucks/fleet).

## Features
- **Mobile-First Design**: Optimized for mobile usage.
- **OTP Login**: Secure entry using mobile number and OTP.
- **Auto-Registration**: Device location and details are registered automatically upon login.
- **Live Tracking**: Real-time location updates using WebSockets.
- **Interactive Map**: Leaflet integration with dark mode styling using OpenStreetMap tiles.
- **Route Tracing**: Accurate route calculation and distance measurement using OpenRouteService API.
- **Distance Display**: Real-time distance calculation between locations.

## Prerequisites
- Node.js installed.
- OpenRouteService API Key (optional, for enhanced route tracing - free tier available).

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configuration (Optional)**
    - Create a `.env` file in the root directory.
    - Add your OpenRouteService API key (optional but recommended):
      ```
      VITE_ORS_API_KEY=your_ors_api_key_here
      ```
    - Get your free API key from [https://openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup)
    - *Note: The app works without an API key but with limited route requests. A free API key provides 2,000 requests/day.*

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
