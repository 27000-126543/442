import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', 'data.db');

let db: SqlJsDatabase;
let SQL: any;

export async function initDatabase(): Promise<SqlJsDatabase> {
  SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  saveDatabase();

  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function createTables() {
  const statements = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_id TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      last_login INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      total_assets REAL NOT NULL DEFAULT 10000,
      influence INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      director_id TEXT,
      budget REAL NOT NULL DEFAULT 0,
      weekly_income REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(company_id, type)
    );

    CREATE TABLE IF NOT EXISTS approval_flows (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      department_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      required_level INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_level_1 TEXT,
      approver_level_2 TEXT,
      approver_level_3 TEXT,
      approved_level_1 INTEGER NOT NULL DEFAULT 0,
      approved_level_2 INTEGER NOT NULL DEFAULT 0,
      approved_level_3 INTEGER NOT NULL DEFAULT 0,
      payload TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS portals (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      source_dimension TEXT NOT NULL,
      target_dimension TEXT NOT NULL,
      risk_level INTEGER NOT NULL DEFAULT 1,
      capacity INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caravans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      portal_id TEXT NOT NULL,
      goods_value REAL NOT NULL,
      guard_power INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      current_position REAL NOT NULL DEFAULT 0,
      total_distance REAL NOT NULL DEFAULT 100,
      progress REAL NOT NULL DEFAULT 0,
      estimated_arrival INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL DEFAULT 0.05,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bonds (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      face_value REAL NOT NULL,
      interest_rate REAL NOT NULL,
      maturity_date INTEGER NOT NULL,
      issued_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      lender_company_id TEXT NOT NULL,
      principal REAL NOT NULL,
      interest_rate REAL NOT NULL,
      remaining_amount REAL NOT NULL,
      due_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS spies (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      skill INTEGER NOT NULL DEFAULT 50,
      stealth INTEGER NOT NULL DEFAULT 50,
      exposure_risk REAL NOT NULL DEFAULT 0,
      target_company_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      mission TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artworks (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      creativity_score REAL NOT NULL DEFAULT 0,
      audience_votes INTEGER NOT NULL DEFAULT 0,
      total_score REAL NOT NULL DEFAULT 0,
      share_count INTEGER NOT NULL DEFAULT 0,
      festival_id TEXT,
      submitted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS festivals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      total_participants INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commercial_towers (
      id TEXT PRIMARY KEY,
      company_ids TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      total_contribution REAL NOT NULL DEFAULT 0,
      required_contribution REAL NOT NULL DEFAULT 100000,
      upgrade_status TEXT NOT NULL DEFAULT 'idle',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tower_contributions (
      id TEXT PRIMARY KEY,
      tower_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      amount REAL NOT NULL,
      contributed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      company_id TEXT,
      department_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      impact REAL NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS economic_indicators (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      global_interest_rate REAL NOT NULL DEFAULT 0.05,
      inflation_rate REAL NOT NULL DEFAULT 0,
      market_volume REAL NOT NULL DEFAULT 0,
      market_index INTEGER NOT NULL DEFAULT 1000
    );

    CREATE TABLE IF NOT EXISTS income_records (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      department TEXT NOT NULL,
      amount REAL NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exchange_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      total_amount REAL NOT NULL,
      filled_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exchange_trades (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      buy_order_id TEXT NOT NULL,
      sell_order_id TEXT NOT NULL,
      buyer_company_id TEXT NOT NULL,
      seller_company_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_assets (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      UNIQUE(company_id, symbol)
    );
  `;

  db.run(statements);
  saveDatabase();
}

export function run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const stmt = db.prepare(sql);
  stmt.run(params);
  const lastId = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] || 0;
  const changesRes = db.exec('SELECT changes() AS c')[0]?.values[0]?.[0] || 0;
  saveDatabase();
  return { lastInsertRowid: lastId, changes: changesRes };
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}
