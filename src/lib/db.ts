import mysql from 'mysql2/promise';

// Reuse a single pool across hot reloads in development.
const g = globalThis as unknown as { __ccPool?: mysql.Pool };

export const pool: mysql.Pool =
  g.__ccPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'callcenter',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });

if (process.env.NODE_ENV !== 'production') g.__ccPool = pool;

/** Run a parameterised SELECT (prepared statement) and return all rows. */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

/** Run a parameterised SELECT and return the first row (or null). */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
