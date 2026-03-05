# Professional SAP / ABAP Integration Guide

This endpoint is specifically designed to handle direct data synchronization from an SAP/ABAP environment using your existing data structure.

**Base URL:** `https://location-tracker-k3hg.onrender.com`

---

## 🚀 Pro Sync: Direct SAP Push
Instead of manually typing URLs, your ABAP system can send its JSON data directly to our server. We have mapped our system to match your SAP field names perfectly.

- **Endpoint**: `POST /api/sap-sync`
- **Method**: `POST`
- **Request Format**: Application/JSON

### 📦 Option A: Send One Truck
Your ABAP backend can send the exact JSON object you already have:

```json
{
  "Mobile_no": "9679686636",
  "Latitude": "22.5414250",
  "Longitude": "88.3619910",
  "Capturedat": "2026-01-08T13:26:13.132Z"
}
```

### 📦 Option B: Send Multiple Trucks (Batch)
If you have 50 trucks updated in SAP, you don't need 50 calls. Just send an array of objects in one single request:

```json
[
  { "Mobile_no": "9679686636", "Latitude": "22.5414", "Longitude": "88.3619", "Capturedat": "..." },
  { "Mobile_no": "9876543210", "Latitude": "28.7041", "Longitude": "77.1025", "Capturedat": "..." }
]
```

---

## 🛰️ Data Mapping Reference
Our server automatically translates your SAP data to our map system:

| SAP Field Name | Tracker Field | Note |
| :--- | :--- | :--- |
| `Mobile_no` | `mobile` | Unique Identifier |
| `Latitude` | `lat` | Coordinate |
| `Longitude` | `lng` | Coordinate |
| `Capturedat` | `timestamp` | ISO String format |

---

## 🔒 No-Hassle Authentication
- **Whitelist**: No OTP or User Login required.
- **Immediate Effect**: The map dashboard will pulse and move the truck(s) the second your ABAP system sends the data.
