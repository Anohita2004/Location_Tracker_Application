# API Documentation for Location Tracker Application

This document outlines the REST API endpoints and real-time Socket.io events used in the Location Tracker backend. These endpoints can be used to integrate with other systems, such as an ABAP backend.

**Base URL:** `https://location-tracker-k3hg.onrender.com`

---

## REST API Endpoints

### 1. Request OTP (Login)
Initiates the login process by sending an OTP to the provided mobile number.
- **Endpoint:** `POST /api/login`
- **Request Body:**
  ```json
  {
    "mobile": "9876543210"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "OTP sent to mobile"
  }
  ```

### 2. Verify OTP
Verifies the OTP and returns the user's current status. If the mobile number is new, a new record is created in the database.
- **Endpoint:** `POST /api/verify-otp`
- **Request Body:**
  ```json
  {
    "mobile": "9876543210",
    "otp": "1234"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "mobile": "9876543210",
      "lat": 28.6139,
      "lng": 77.2090,
      "last_updated": "2024-05-20T10:00:00.000Z"
    }
  }
  ```
- **Error Response (400 Bad Request):**
  ```json
  {
    "success": false,
    "message": "Invalid OTP"
  }
  ```

### 3. Update Location
Updates the real-time coordinates of a device and logs the movement to the history table.
- **Endpoint:** `POST /api/update-location`
- **Request Body:**
  ```json
  {
    "mobile": "9876543210",
    "lat": 12.9716,
    "lng": 77.5946
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### 4. Fetch Location History
Retrieves historical coordinates for a specific device on a specific date.
- **Endpoint:** `GET /api/history`
- **Query Parameters:**
  - `mobile`: The device's mobile number (e.g., `9876543210`)
  - `date`: The date for which history is needed in `YYYY-MM-DD` format (e.g., `2024-05-20`)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "history": [
      {
        "id": 1,
        "mobile": "9876543210",
        "lat": 12.9716,
        "lng": 77.5946,
        "timestamp": "2024-05-20T10:05:00.000Z"
      }
    ]
  }
  ```

---

## Real-time Events (Socket.io)

The backend uses Socket.io for live updates on the dashboard.

### Events Emitted by Server
- **`initial-data`**: Emitted immediately upon connection.
  - **Payload**: Array of all devices with their latest coordinates.
- **`location-update`**: Broadcasted to all connected clients whenever a device's location is updated via `/api/update-location`.
  - **Payload**: A single device object with updated coordinates.

---

## Database Schema (Reference for Backend Fields)

If creating fields in an ABAP backend or database, the following structure is primarily used:

### `devices` Table (Current State)
| Field | Type | Description |
| :--- | :--- | :--- |
| `mobile` | VARCHAR(20) | Primary Key / Unique Identifier |
| `lat` | DOUBLE PRECISION | Current Latitude |
| `lng` | DOUBLE PRECISION | Current Longitude |
| `last_updated` | TIMESTAMP | Last sync time |

### `location_history` Table (Historical Logs)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | SERIAL | Primary Key |
| `mobile` | VARCHAR(20) | Foreign Key / Identifier |
| `lat` | DOUBLE PRECISION | Latitude at that time |
| `lng` | DOUBLE PRECISION | Longitude at that time |
| `timestamp` | TIMESTAMP | Time of record |
