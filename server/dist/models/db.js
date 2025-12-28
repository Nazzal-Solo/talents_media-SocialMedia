"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = exports.query = exports.pool = void 0;
const pg_1 = require("pg");
require("dotenv/config");
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
const query = (text, params, timeoutMs = 15000) => {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`));
        }, timeoutMs);
    });
    const queryPromise = exports.pool.query(text, params).then((result) => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
        return {
            rows: result.rows,
            rowCount: result.rowCount || 0,
        };
    }).catch((error) => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
        throw error;
    });
    return Promise.race([queryPromise, timeoutPromise]);
};
exports.query = query;
const testConnection = async () => {
    try {
        const startTime = Date.now();
        const client = await exports.pool.connect();
        const duration = Date.now() - startTime;
        console.log(`✅ Database connected successfully (${duration}ms)`);
        const testQueryStart = Date.now();
        await client.query('SELECT 1');
        const testQueryDuration = Date.now() - testQueryStart;
        console.log(`✅ Database query test successful (${testQueryDuration}ms)`);
        client.release();
    }
    catch (err) {
        console.error('❌ Database connection failed:', {
            message: err.message,
            code: err.code,
            stack: err.stack,
        });
        console.error('💡 Check your DATABASE_URL environment variable and Neon connection status');
        process.exit(1);
    }
};
exports.testConnection = testConnection;
//# sourceMappingURL=db.js.map