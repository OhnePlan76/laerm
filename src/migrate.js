require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const db = require("./db");

async function runMigrations() {
  const client = await db.getClient();
  const migrationsDir = path.join(__dirname, "..", "migrations");

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query("COMMIT");

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM migrations WHERE filename = $1", [file]);
      if (applied.rowCount > 0) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Migration angewendet: ${file}`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Migrationen abgeschlossen.");
      return db.pool.end();
    })
    .catch(async (error) => {
      console.error("Migration fehlgeschlagen:", error);
      await db.pool.end().catch(() => {});
      process.exit(1);
    });
}

module.exports = { runMigrations };
