# Deployment Guide: Render.com

This guide outlines the steps to deploy the **Location Tracker** application (Backend + Web Frontend) to [Render](https://render.com).

## 1. Prerequisites
- A [GitHub](https://github.com) repository containing your code.
- A [Render](https://render.com) account.

## 2. Step-by-Step Deployment

### Step A: Create a PostgreSQL Database
The application requires a database to store device locations and history.
1. Log in to Render and click **New > PostgreSQL**.
2. Name it `location-tracker-db`.
3. Click **Create Database**.
4. Once created, find the **External Database URL** (or Internal if deploying in the same region). You will need this for the next step.

### Step B: Create a Web Service
This will host both your Express backend and the Vite web frontend.
1. Click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Name:** `location-tracker`
   - **Environment:** `Node`
   - **Region:** (Select the same region as your database)
   - **Branch:** `main` (or your default branch)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

### Step C: Environment Variables
Go to the **Environment** tab of your Web Service and add the following:
| Key | Value |
| :--- | :--- |
| `DATABASE_URL` | *Paste your PostgreSQL Connection String here* |
| `NODE_ENV` | `production` |

> [!TIP]
> Your `server/index.js` already handles `DATABASE_URL` and uses SSL for Render connections automatically.

## 3. Updating the Mobile App
Once your service is live (e.g., `https://location-tracker.onrender.com`), you must update the mobile app to point to this new URL.

1. Open `mobile-app/services/api.js`.
2. Change `API_URL` to your Render URL:
```javascript
const API_URL = 'https://location-tracker.onrender.com';
```

## 4. Verification
- Visit your Render URL in the browser to see the Web Dashboard.
- Open the Mobile App and check if it successfully connects and updates the location.

---
**Note:** Ensure your `.gitignore` includes `node_modules` and `.env` to avoid leaking sensitive credentials to GitHub.
