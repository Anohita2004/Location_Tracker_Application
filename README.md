# 🚛 FleetOps: Enterprise Location Intelligence Dashboard
> **High-Performance Supply Chain Visibility Solution following SAP Fiori® Design Principles.**

[![SAP Fiori](https://img.shields.io/badge/Design-SAP%20Fiori%203.0-blue.svg)](https://experience.sap.com/fiori-design/)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-indigo.svg)]()
[![Real-time](https://img.shields.io/badge/Network-Socket.io-green.svg)]()

## 🌐 Overview
**FleetOps** is a real-time logistics tracking ecosystem designed to bridge the gap between field operations and enterprise resource planning. Built with a focus on **SAP S/4HANA integration patterns**, it provides supply chain managers with instant visibility into fleet movements, delivery statuses, and regional logistics health.

As an **SAP Fiori-inspired project**, the UI adheres to role-based design principles, ensuring that complex logistics data is simplified into actionable intelligence through analytical KPIs and interactive spatial visualization.

---

## ✨ Standout Enterprise Features

### 📊 1. Fiori Analytical KPI Layer
- **Overview Page (OVP) Pattern**: Top-level metrics for "Total Assets," "Active Logistics," and "Critical Offline Alerts."
- **Executive Insight**: Provides immediate situational awareness without requiring deep-dive navigation.

### 🗺️ 2. High-Fidelity Spatial Intelligence
- **Real-time Synchronization**: Powered by Socket.io for sub-second location updates.
- **Dynamic Asset Context**: Custom-rendered diamond-shaped markers that change visual state based on real-time telematics.
- **Historical Playback**: Reconstruct past journeys of any asset to audit delivery routes and identifying stop-points.

### 🔗 3. SAP Business Object Mapping
- **Delivery ID Integration**: Assets are mapped to mock **SAP Outbound Delivery (LIKP/LIPS)** identifiers.
- **Cross-System Logic**: Designed to demonstrate how transactional data from S/4HANA (SD/TM modules) can be visualized in a custom React portal.

### 📱 4. Mobilebroadcasting & IoT
- **Capacitor Geolocation**: Seamlessly tracks field drivers via a mobile-optimized PWA layer.
- **Robustness**: Handles intermittent network signals with clear visual "Broadcasting" indicators.

---

## 🛠️ Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | **React 19 + Vite** | High-performance, reactive UI |
| **Styling** | **Custom CSS (Glassmorphism)** | Premium SAP Fiori Horizon aesthetic |
| **Maps** | **Leaflet.js + OSM** | Open-source spatial engine |
| **Real-time** | **Socket.io** | Bidirectional event-based communication |
| **Backend** | **Node.js (Express 5)** | Scalable API & Gateway |
| **Database** | **PostgreSQL** | Relational storage for telemetry & history |

---

## 🚀 Quick Start (Local Development)

### 1. Project Initialization
```bash
git clone <repository-url>
cd Location_Tracker_Application
npm install
```

### 2. Database Setup
The server automatically initializes migrations and seeds **Regional Demo Data** (North/South/East/West trucks) on the first run.
- Ensure PostgreSQL is running.
- (Optional) Create a `.env` with `DATABASE_URL=postgres://user:pass@localhost:5432/db_name`.

### 3. Launching the Ecosystem
**Terminal A (Backend Infrastructure):**
```bash
npm run server
```

**Terminal B (Frontend Experience):**
```bash
npm run dev
```

### 4. Testing the "Happy Path"
1. Navigate to `http://localhost:5173`.
2. **Login**: Use any mobile number (e.g., `88888 88888`).
3. **Verify**: Use code `1234` (Mock OTP).
4. **Interact**: Explore the regional sidebar, click a truck to view its **SAP Delivery ID**, and trigger a "Route" to your location.

---

## 📄 Documentation Reference
For detailed technical implementation details regarding SAP connectivity, refer to:
👉 **[SAP_INTEGRATION_GUIDE.md](./SAP_INTEGRATION_GUIDE.md)**

---

## 👨‍💻 Portfolio Context (SAP Fiori Trainee)
This project serves as a technical showcase for:
- Understanding of **SAP UX Design Principles**.
- Ability to bridge **Web Technologies (React)** with **Enterprise Business Logic (ABAP/S/4HANA)**.
- Knowledge of **OData/RESTful API consumption** patterns in a logistics context.
