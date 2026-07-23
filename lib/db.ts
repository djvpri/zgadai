// lib/db.ts
// PostgreSQL connection pool — menggantikan Supabase client.
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export default pool;

// ---------- Helper queries ----------

/** Jalankan query, return rows */
export async function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

/** Jalankan query, return single row */
export async function dbOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return (rows[0] as T) || null;
}

/** Jalankan INSERT/UPDATE/DELETE, return row hasil RETURNING (atau null) */
export async function dbRun<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return (rows[0] as T) || null;
}
