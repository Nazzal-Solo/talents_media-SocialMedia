import { Pool } from 'pg';
import 'dotenv/config';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Connection pool settings for better performance and reliability
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
});

// Query wrapper with timeout protection
// Increased timeout for feed queries which may need more time with large datasets
export const query = <T = any>(text: string, params?: any[], timeoutMs: number = 15000): Promise<{ rows: T[]; rowCount: number }> => {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<{ rows: T[]; rowCount: number }>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`));
    }, timeoutMs);
  });
  
  const queryPromise = pool.query(text, params).then((result) => {
    // Clear timeout if query completes
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  }).catch((error) => {
    // Clear timeout if query fails
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    throw error;
  });
  
  return Promise.race([queryPromise, timeoutPromise]);
};

// Test database connection
export const testConnection = async () => {
  try {
    const startTime = Date.now();
    const client = await pool.connect();
    const duration = Date.now() - startTime;
    console.log(`✅ Database connected successfully (${duration}ms)`);
    
    // Test a simple query to ensure database is responsive
    const testQueryStart = Date.now();
    await client.query('SELECT 1');
    const testQueryDuration = Date.now() - testQueryStart;
    console.log(`✅ Database query test successful (${testQueryDuration}ms)`);
    
    client.release();
  } catch (err: any) {
    console.error('❌ Database connection failed:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });
    console.error('💡 Check your DATABASE_URL environment variable and Neon connection status');
    process.exit(1);
  }
};
