import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Database Connection
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Support local fallback if DATABASE_URL is missing
    ...(process.env.DATABASE_URL ? {
        ssl: { rejectUnauthorized: false }
    } : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'location_tracker',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
    })
});

// Initialize DB and Seed Data
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS devices (
                mobile VARCHAR(20) PRIMARY KEY,
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS location_history (
                id SERIAL PRIMARY KEY,
                mobile VARCHAR(20),
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database tables 'devices' and 'location_history' ready.");

        // Check if we need to seed demo data
        // User requested "demo entries" for North/South/East/West features
        // Check if demo data exists (check for North-Truck-1)
        const res = await pool.query("SELECT * FROM devices WHERE mobile = 'North-Truck-1'");
        if (res.rows.length === 0) { // Seed if demo truck missing
            console.log("Seeding regional demo data...");
            const seedQueries = [
                // North (Delhi area)
                `INSERT INTO devices (mobile, lat, lng) VALUES ('North-Truck-1', 28.7041, 77.1025)`,
                `INSERT INTO devices (mobile, lat, lng) VALUES ('North-Truck-2', 30.7333, 76.7794)`, // Chandigarh

                // South (Bangalore/Chennai)
                `INSERT INTO devices (mobile, lat, lng) VALUES ('South-Truck-1', 12.9716, 77.5946)`,
                `INSERT INTO devices (mobile, lat, lng) VALUES ('South-Truck-2', 13.0827, 80.2707)`,

                // East (Kolkata)
                `INSERT INTO devices (mobile, lat, lng) VALUES ('East-Truck-1', 22.5726, 88.3639)`,
                `INSERT INTO devices (mobile, lat, lng) VALUES ('East-Truck-2', 26.1445, 91.7362)`, // Guwahati

                // West (Mumbai/Pune)
                `INSERT INTO devices (mobile, lat, lng) VALUES ('West-Truck-1', 19.0760, 72.8777)`,
                `INSERT INTO devices (mobile, lat, lng) VALUES ('West-Truck-2', 18.5204, 73.8567)`
            ];
            for (let q of seedQueries) {
                await pool.query(q);
            }
            // Seed history for demo trucks so date filter works for them too (optional but good)
        }
        console.log(`Database ready.`);
    } catch (err) {
        console.error("Database Initialization Error:", err.message);
        console.log("HINT: Make sure PostgreSQL is running and you have created the database specified in .env");
    }
};

initDB();

io.on('connection', async (socket) => {
    // Send current data from DB
    try {
        const res = await pool.query('SELECT * FROM devices');
        socket.emit('initial-data', res.rows);
    } catch (err) {
        console.error("Error fetching initial data", err);
    }

    socket.on('disconnect', () => {
        // console.log('Client disconnected');
    });
});

app.post('/api/login', (req, res) => {
    const { mobile } = req.body;
    console.log(`OTP requested for ${mobile}`);
    // In a real app, generate and save OTP here
    res.json({ success: true, message: 'OTP sent to mobile' });
});

app.get('/api/history', async (req, res) => {
    const { mobile, date } = req.query;
    if (!mobile || !date) return res.status(400).json({ error: 'Missing mobile or date' });

    try {
        // Query for records on that specific date
        // Assuming 'date' string is YYYY-MM-DD
        const query = `
            SELECT * FROM location_history 
            WHERE mobile = $1 
            AND date_trunc('day', timestamp) = $2::date
            ORDER BY timestamp DESC
        `;
        const result = await pool.query(query, [mobile, date]);
        res.json({ success: true, history: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET all devices status (SAP/ABAP Friendly)
app.get('/api/devices', async (req, res) => {
    try {
        const result = await pool.query('SELECT mobile AS "Mobile_no", lat AS "Latitude", lng AS "Longitude", last_updated AS "Capturedat" FROM devices');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// New Endpoint for Manager/ABAP Integration
// Fetches the latest coordinates and time for a specific mobile number directly
app.get('/api/device-status/:mobile', async (req, res) => {
    const { mobile } = req.params;

    try {
        const query = 'SELECT mobile, lat, lng, last_updated FROM devices WHERE mobile = $1';
        const result = await pool.query(query, [mobile]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;

    if (otp === '1234') {
        try {
            // Check if user exists, if not create
            const checkRes = await pool.query('SELECT * FROM devices WHERE mobile = $1', [mobile]);
            let user = checkRes.rows[0];

            if (!user) {
                await pool.query('INSERT INTO devices (mobile, last_updated) VALUES ($1, NOW())', [mobile]);
                user = { mobile, lat: null, lng: null, last_updated: new Date() };
            }

            res.json({ success: true, user });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Database error' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
});

// Alternate GET endpoint for simple URL calls (ABAP Integration)
app.get('/api/update', async (req, res) => {
    const { mobile, lat, lng, timestamp } = req.query;
    if (!mobile || !lat || !lng) return res.status(400).json({ error: 'Missing data. Use: ?mobile=X&lat=Y&lng=Z' });

    const finalTimestamp = timestamp ? new Date(timestamp) : new Date();

    try {
        const query = `
          INSERT INTO devices (mobile, lat, lng, last_updated)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (mobile) 
          DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_updated = EXCLUDED.last_updated
          RETURNING *;
      `;
        const result = await pool.query(query, [mobile, lat, lng, finalTimestamp]);
        const updatedUser = result.rows[0];

        await pool.query('INSERT INTO location_history (mobile, lat, lng, timestamp) VALUES ($1, $2, $3, $4)', [mobile, lat, lng, finalTimestamp]);

        io.emit('location-update', updatedUser);
        res.json({ success: true, message: 'Map updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// SAP/ABAP Direct Sync Endpoint
// Accepts the specific JSON format from SAP (Mobile_no, Latitude, Longitude, Capturedat)
app.post('/api/sap-sync', async (req, res) => {
    let data = req.body;
    
    // Handle both single object and array of objects
    const updates = Array.isArray(data) ? data : [data];
    const results = [];

    try {
        for (const item of updates) {
            // Map SAP fields to our DB fields
            const mobile = item.Mobile_no || item.mobile;
            const lat = parseFloat(item.Latitude || item.lat);
            const lng = parseFloat(item.Longitude || item.lng);
            const timestamp = item.Capturedat || item.last_updated || new Date();

            if (!mobile || isNaN(lat) || isNaN(lng)) {
                results.push({ mobile: mobile || 'unknown', success: false, error: 'Missing or invalid data' });
                continue;
            }

            const query = `
                INSERT INTO devices (mobile, lat, lng, last_updated)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (mobile) 
                DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_updated = EXCLUDED.last_updated
                RETURNING *;
            `;
            const result = await pool.query(query, [mobile, lat, lng, timestamp]);
            const updatedUser = result.rows[0];

            await pool.query('INSERT INTO location_history (mobile, lat, lng, timestamp) VALUES ($1, $2, $3, $4)', [mobile, lat, lng, timestamp]);

            // Broadcast to real-time map
            io.emit('location-update', updatedUser);
            results.push({ mobile, success: true });
        }

        res.json({ success: true, processed: results.length, details: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

app.post('/api/update-location', async (req, res) => {
    const { mobile, lat, lng, timestamp } = req.body;
    if (!mobile || !lat || !lng) return res.status(400).json({ error: 'Missing data' });

    // Use provided timestamp or current server time
    const finalTimestamp = timestamp ? new Date(timestamp) : new Date();

    try {
        // 1. Update latest device location
        const query = `
          INSERT INTO devices (mobile, lat, lng, last_updated)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (mobile) 
          DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_updated = EXCLUDED.last_updated
          RETURNING *;
      `;
        const result = await pool.query(query, [mobile, lat, lng, finalTimestamp]);
        const updatedUser = result.rows[0];

        // 2. Log to history
        await pool.query('INSERT INTO location_history (mobile, lat, lng, timestamp) VALUES ($1, $2, $3, $4)', [mobile, lat, lng, finalTimestamp]);

        // Broadcast update to all connected clients
        io.emit('location-update', updatedUser);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Serve Static Assets in Production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// For any other request, send back index.html (SPA logic)
// Use a version-agnostic middleware to avoid Express 5 wildcard syntax issues
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server running on port ${PORT}`);
});
