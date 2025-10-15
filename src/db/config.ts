import { Pool } from "pg";
import "dotenv/config"

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT ?? "5432"),
    
    // Connection pool configuration
    max: 20, // Maximum number of clients in the pool
    min: 5,  // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    maxUses: 7500, // Close and replace a connection after it has been used this many times
    
    // Keep alive configuration
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Delay before starting keep alive
    
    // SSL configuration (for production)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Error handling for the pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', (client) => {
    console.log('New database client connected');
});

pool.on('acquire', (client) => {
    console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
    console.log('Client removed from pool');
});

// Monitor pool status
setInterval(() => {
    console.log(`Pool status - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
}, 60000); // Log every minute

export default pool;