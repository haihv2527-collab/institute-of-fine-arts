const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/ifa.db";
const resolvedPath = path.resolve(DB_PATH);

// Ensure the data directory exists
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run schema.sql once on startup (idempotent — uses IF NOT EXISTS everywhere)
const schemaPath = path.join(__dirname, "..", "models", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

/**
 * CREATE TABLE IF NOT EXISTS can't add a column to a table that already
 * exists from before the column was introduced. This runs any pending
 * "add column" migrations so databases created with an older schema.sql
 * catch up automatically the next time the server starts — no manual
 * `npm run seed` or DB reset required.
 */
function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((c) => c.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Migrated: added ${table}.${column}`);
  }
}

ensureColumn("exhibition_paintings", "paid_at", "TEXT");

module.exports = db;
