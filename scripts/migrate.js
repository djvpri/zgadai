// scripts/migrate.js
// Run all pending SQL migrations in order (001 → 002 → 003 → ...)
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const dns = require("dns");

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL tidak diset!");
    process.exit(1);
  }

  // Skip migration at build time (DB host not resolvable)
  const hostname = new URL(process.env.DATABASE_URL).hostname;
  try {
    await dns.promises.lookup(hostname);
  } catch {
    console.log("⚠️ DB host unreachable (build time), skipping migration");
    process.exit(0);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      // Get already applied migrations
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id serial primary key,
          file text unique not null,
          applied_at timestamptz default now()
        )
      `);

      const result = await client.query("SELECT file FROM _migrations ORDER BY id");
      const applied = new Set(result.rows.map(r => r.file));

      const migrationsDir = path.join(__dirname, "../migrations");
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        if (applied.has(file)) {
          console.log(`  ✓ ${file} (already applied)`);
          continue;
        }

        console.log(`  → ${file} ...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (file) VALUES ($1)", [file]);
        console.log(`    ✓ done`);
      }

      console.log("✅ All migrations up to date");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
