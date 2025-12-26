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

app.post('/api/update-location', async (req, res) => {
    const { mobile, lat, lng } = req.body;
    if (!mobile || !lat || !lng) return res.status(400).json({ error: 'Missing data' });

    try {
        // 1. Update latest device location
        const query = `
          INSERT INTO devices (mobile, lat, lng, last_updated)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (mobile) 
          DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_updated = NOW()
          RETURNING *;
      `;
        const result = await pool.query(query, [mobile, lat, lng]);
        const updatedUser = result.rows[0];

        // 2. Log to history
        await pool.query('INSERT INTO location_history (mobile, lat, lng, timestamp) VALUES ($1, $2, $3, NOW())', [mobile, lat, lng]);

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
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
