# API Documentation for ABAP Integration (Data Fetching)

This document explains how to retrieve real-time truck location data from the system into your ABAP backend. 

**Base URL:** `https://location-tracker-k3hg.onrender.com`

---

## 🔒 Authentication & Security
- **No Login Required**: These endpoints are open for server-to-server data retrieval.
- **No OTP Required**: No mobile verification is needed for fetching data.
- **Method**: All integration requests use a simple `GET` method.

---

## 🛰️ Available Endpoints

### 1. Fetch Status of ALL Trucks
Use this to get the current latitude, longitude, and last-updated time for every truck in the system at once.
- **Endpoint**: `GET /api/devices`
- **Full URL**: `https://location-tracker-k3hg.onrender.com/api/devices`
- **Response Format (JSON)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "mobile": "North-Truck-1",
        "lat": 28.7041,
        "lng": 77.1025,
        "last_updated": "2024-03-05T14:30:00.000Z"
      },
      {
        "mobile": "South-Truck-1",
        "lat": 12.9716,
        "lng": 77.5946,
        "last_updated": "2024-03-05T14:35:00.000Z"
      }
    ]
  }
  ```

### 2. Fetch Status of a SINGLE Truck
Use this if you only need the coordinates for one specific mobile number.
- **Endpoint**: `GET /api/device-status/:mobile`
- **Example**: `https://location-tracker-k3hg.onrender.com/api/device-status/9876543210`
- **Response Format (JSON)**:
  ```json
  {
    "success": true,
    "data": {
      "mobile": "9876543210",
      "lat": 28.6139,
      "lng": 77.2090,
      "last_updated": "2024-03-05T14:40:00.000Z"
    }
  }
  ```

---

## 🛠️ Field Reference for ABAP
| Field | Type | Description |
| :--- | :--- | :--- |
| `mobile` | String | Unique ID of the truck (Mobile Number) |
| `lat` | Double/Float | Current Latitude coordinate |
| `lng` | Double/Float | Current Longitude coordinate |
| `last_updated` | ISO-8601 String | The exact date and time of the last GPS ping |

---

## Technical Workflow
1.  **Mobile App**: Drivers log in on their phones and start their GPS.
2.  **Server**: The server stores these pings in the database.
3.  **ABAP Backend**: Your system calls the `GET` endpoints above to fetch these coordinates and populate your internal fields/dashboard.
