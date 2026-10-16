import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DATABASE_POOL_MIN || '0', 10),
  max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 1000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query text with $1, $2, ... placeholders
 * @param {any[]} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100)}...`);
  }
  return result;
}

/**
 * Get a client from the pool for transaction use.
 * Caller MUST call client.release() when done.
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Execute a callback within a serializable transaction.
 * Automatically commits on success, rolls back on error.
 * @param {(client: pg.PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close database pool cleanly during shutdown / testing.
 */
export async function closePool() {
  try {
    // Destroy underlying sockets if connecting
    if (pool._clients) {
      for (const client of pool._clients) {
        try {
          if (client.connection && client.connection.stream) {
            client.connection.stream.destroy();
          }
        } catch {}
      }
    }
    await pool.end();
  } catch {}
}

export { pool };
