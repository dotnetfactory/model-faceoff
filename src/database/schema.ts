import Database from 'better-sqlite3';

/**
 * Desktop Starter App Database Schema
 *
 * Tables:
 * - settings: Application settings key-value store
 *
 * Add your own tables below by following the pattern.
 */

export function initializeDatabase(db: Database.Database): void {
  console.log('Initializing database schema...');

  // Create settings table
  createSettingsTable(db);

  // Model comparison tables
  createPresetsTable(db);
  createConversationsTable(db);
  createMessagesTable(db);
  createApiLogsTable(db);

  console.log('Database schema initialization complete');
}

function createSettingsTable(db: Database.Database): void {
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='settings'
  `).get();

  if (!tableExists) {
    console.log('Creating settings table...');
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('settings table created successfully');
  }
}

/**
 * Presets table - stores model comparison presets
 */
function createPresetsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='presets'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating presets table...');
    db.exec(`
      CREATE TABLE presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        models TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('presets table created successfully');
  }
}

/**
 * Conversations table - stores conversation sessions
 */
function createConversationsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='conversations'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating conversations table...');
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        models TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('conversations table created successfully');
  }
}

/**
 * Messages table - stores individual messages in conversations
 */
function createMessagesTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='messages'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating messages table...');
    db.exec(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model_id TEXT,
        panel_index INTEGER,
        tokens_prompt INTEGER,
        tokens_completion INTEGER,
        latency_ms INTEGER,
        cost REAL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_messages_conversation ON messages(conversation_id);
    `);
    console.log('messages table created successfully');
  }
}

/**
 * API Logs table - stores all API call logs
 */
function createApiLogsTable(db: Database.Database): void {
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='api_logs'
  `
    )
    .get();

  if (!tableExists) {
    console.log('Creating api_logs table...');
    db.exec(`
      CREATE TABLE api_logs (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        model_id TEXT NOT NULL,
        provider TEXT,
        request_tokens INTEGER,
        response_tokens INTEGER,
        total_tokens INTEGER,
        latency_ms INTEGER NOT NULL,
        cost REAL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_api_logs_created ON api_logs(created_at);
      CREATE INDEX idx_api_logs_model ON api_logs(model_id);
    `);
    console.log('api_logs table created successfully');
  }
}
