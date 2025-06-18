// ==========================================
// config/database.js - Azure SQL Database connection
// ==========================================
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, // e.g., 'your-server.database.windows.net'
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Required for Azure SQL
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    connectionTimeout: 60000,
    requestTimeout: 60000
};

let pool;

async function connectToDatabase() {
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to Azure SQL Database');
        
        // Test the connection
        await pool.request().query('SELECT 1 as test');
        console.log('✅ Database connection test successful');
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
}
const setPool = (dbPool) => {
    pool = dbPool;
};

function getPool() {
    if (!pool) {
        throw new Error('Database not connected');
    }
    return pool;
}

module.exports = { connectToDatabase, getPool,setPool, sql };
