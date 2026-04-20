/**
 * database.js – SQLite über sql.js (pure JavaScript, kein C++ Compiler nötig)
 * Die Datenbank wird aus einer Datei geladen, Änderungen werden sofort zurückgeschrieben.
 */
const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'haushaltsbuch.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _sqlJs = null;
let _db    = null;

async function init() {
  if (_db) return _db;

  _sqlJs = await initSqlJs();

  // DB aus Datei laden (oder neu erstellen)
  const fileData = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  _db = new _sqlJs.Database(fileData || undefined);

  _db.run('PRAGMA foreign_keys = ON;');

  // Schema erstellen
  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription TEXT    NOT NULL,
      created_at   TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, subscription)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      description  TEXT    NOT NULL DEFAULT '',
      assigned_to  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recurrence   TEXT    NOT NULL DEFAULT 'daily',
      time_of_day  TEXT    NOT NULL DEFAULT '08:00',
      day_of_week  INTEGER DEFAULT NULL,
      day_of_month INTEGER DEFAULT NULL,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_by   INTEGER NOT NULL REFERENCES users(id),
      created_at   TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      completed_at    TEXT    DEFAULT (datetime('now')),
      completion_date TEXT    NOT NULL,
      UNIQUE(task_id, completion_date)
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      quantity   TEXT    NOT NULL DEFAULT '',
      added_by   INTEGER NOT NULL REFERENCES users(id),
      in_cart    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      event_date  TEXT    NOT NULL,
      event_time  TEXT    DEFAULT NULL,
      end_time    TEXT    DEFAULT NULL,
      color       TEXT    NOT NULL DEFAULT '#1A56DB',
      created_by  INTEGER NOT NULL REFERENCES users(id),
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_plan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_date   TEXT    NOT NULL,
      meal_type   TEXT    NOT NULL,
      title       TEXT    NOT NULL,
      recipe_id   INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(meal_date, meal_type)
    );

    CREATE TABLE IF NOT EXISTS shift_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      start_time TEXT    NOT NULL DEFAULT '',
      end_time   TEXT    NOT NULL DEFAULT '',
      color      TEXT    NOT NULL DEFAULT '#1A56DB',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shift_entries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date    TEXT    NOT NULL,
      entry_type    TEXT    NOT NULL,
      shift_type_id INTEGER REFERENCES shift_types(id) ON DELETE SET NULL,
      created_at    TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, entry_date)
    );
  `);

  persistDb();
  return _db;
}

// DB-Datei nach jeder Schreiboperation speichern
function persistDb() {
  if (!_db) return;
  const exported = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(exported));
}

// ─── Hilfsfunktionen für sync-ähnliche API ────────────────────────────────────

/** Gibt ein einzelnes Objekt zurück (wie better-sqlite3 .get()) */
function get(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

/** Gibt alle Zeilen zurück (wie better-sqlite3 .all()) */
function all(sql, params = []) {
  const stmt    = _db.prepare(sql);
  const results = [];
  stmt.bind(params);
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

/** Führt eine schreibende Abfrage aus (wie better-sqlite3 .run()) */
function run(sql, params = []) {
  _db.run(sql, params);
  persistDb();
  return { lastInsertRowid: _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
}

/** Mehrere Statements in einer Transaktion */
function exec(sql) {
  _db.run(sql);
  persistDb();
}

module.exports = { init, get, all, run, exec, persistDb };
