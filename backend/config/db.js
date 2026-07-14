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

module.exports = db;
