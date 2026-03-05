# API Documentation for ABAP/SAP Integration

This document explains how your ABAP backend can communicate with the Location Tracker system to either **Push** information onto the map or **Pull** information into SAP.

**Base URL:** `https://location-tracker-k3hg.onrender.com`

---

## 🚀 1. Pushing Data FROM ABAP TO the Live Map
Use this if you have location data in your ABAP backend and you want it to appear instantly on the web map dashboard.

- **Method**: `GET` (for simplest integration)
- **URL Format**: `https://location-tracker-k3hg.onrender.com/api/update?mobile=XXXX&lat=XXXX&lng=XXXX&timestamp=XXXX`
- **Example Call**: 
  `https://location-tracker-k3hg.onrender.com/api/update?mobile=9876543210&lat=28.7041&lng=77.1025&timestamp=2024-03-05T16:30:00Z`

**Result**: As soon as this URL is called, the truck icon on the map moves to the new coordinates.

---

## 🛰️ 2. Fetching Data FROM the Tracker TO ABAP
Use this if you want to pull the latest coordinates (sent by mobile phones) into your SAP fields.

### A. Get ALL Trucks
- **Full URL**: `https://location-tracker-k3hg.onrender.com/api/devices`
- **Response**: Returns a JSON array of all active trucks and their latest coordinates.

### B. Get a SINGLE Truck
- **Full URL**: `https://location-tracker-k3hg.onrender.com/api/device-status/9876543210`
- **Response**: Returns the lat, lng, and timestamp for that specific mobile number.

---

## 🛠️ Field Reference
| Field | Type | Description |
| :--- | :--- | :--- |
| `mobile` | String | Unique ID of the truck (Mobile Number) |
| `lat` | Float | Current Latitude coordinate |
| `lng` | Float | Current Longitude coordinate |
| `last_updated` | Date String | The exact date and time of the last update |

---

## 🔒 Security Summary
- **No Login/OTP required** for these backend-to-backend calls.
- Purely based on the `mobile` number as the unique identifier.
