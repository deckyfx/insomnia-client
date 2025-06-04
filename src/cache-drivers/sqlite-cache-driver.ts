// CHANGELOG: [2025-06-05] - Created SQLite cache driver using Bun's built-in SQLite API

import { Database } from "bun:sqlite";
import type {
  CacheEntry,
  ClearCacheOptions,
  GetCacheOptions,
  SetCacheOptions,
} from "../@types/cache/index";
import { CacheDriver } from "./base-cache-driver";

/**
 * SQLite-based cache driver implementation
 * Stores cache entries in an SQLite database using Bun's native SQLite API
 * Data persists between application restarts with better performance than file-based storage
 * @example
 * ```typescript
 * const cache = new SQLiteCacheDriver('./data.db');
 * await cache.set('auth_token', 'bearer_xyz', { ttl: 3600000 });
 * const token = await cache.get('auth_token');
 * ```
 */
export class SQLiteCacheDriver extends CacheDriver {
  private db: Database;
  private readonly tableName = "caches";

  /**
   * Creates a new SQLiteCacheDriver instance
   * @param dbPath - Path to the SQLite database file
   * @example
   * ```typescript
   * const cache = new SQLiteCacheDriver('./data.db');
   * ```
   */
  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initializes the database schema for cache entries
   */
  private initializeDatabase(): void {
    // Create the cache entries table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        metadata TEXT,
        UNIQUE(key)
      )
    `);

    // Create index on key for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_key 
      ON ${this.tableName}(key)
    `);

    // Create index on expires_at for faster cleanup operations
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires 
      ON ${this.tableName}(expires_at)
    `);
  }

  /**
   * Converts a database row to a CacheEntry object
   * @param row - Database row object
   * @returns CacheEntry object
   */
  private rowToCacheEntry(row: any): CacheEntry {
    return {
      id: row.id,
      key: row.key,
      value: JSON.parse(row.value),
      createdAt: row.created_at,
      expiresAt: row.expires_at || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Gets a cached value by key
   * @param key - The cache key to retrieve
   * @param options - Options for getting the cached value
   * @returns Promise resolving to the cache entry if found and not expired, undefined otherwise
   */
  async get(
    key: string,
    options?: GetCacheOptions
  ): Promise<CacheEntry | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName} WHERE key = ?
    `);
    
    const row = stmt.get(key);
    if (!row) {
      return undefined;
    }

    const entry = this.rowToCacheEntry(row);
    const now = Date.now();

    // Check if entry is expired
    if (entry.expiresAt && entry.expiresAt <= now) {
      if (options?.ignoreExpired === false) {
        return entry; // Return expired entry if requested
      }
      
      // Remove expired entry
      const deleteStmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE key = ?
      `);
      deleteStmt.run(key);
      return undefined;
    }

    return entry;
  }

  /**
   * Sets a cached value
   * @param key - The cache key
   * @param value - The value to cache
   * @param options - Options for setting the cached value
   * @returns Promise resolving when the value is cached
   */
  async set(key: string, value: any, options?: SetCacheOptions): Promise<void> {
    const now = Date.now();
    let expiresAt: number | undefined;

    // Calculate expiration time
    if (options?.expiresAt) {
      expiresAt = options.expiresAt;
    } else if (options?.ttl) {
      expiresAt = now + options.ttl;
    }

    const id = crypto.randomUUID();
    const valueJson = JSON.stringify(value);
    const metadataJson = options?.metadata ? JSON.stringify(options.metadata) : null;

    // Use INSERT OR REPLACE to handle updates
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tableName} 
      (id, key, value, created_at, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, key, valueJson, now, expiresAt || null, metadataJson);
  }

  /**
   * Checks if a cached value exists and is not expired
   * @param key - The cache key to check
   * @returns Promise resolving to true if the key exists and is valid, false otherwise
   */
  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== undefined;
  }

  /**
   * Removes a specific cached value
   * @param key - The cache key to remove
   * @returns Promise resolving to true if the key was removed, false if not found
   */
  async delete(key: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName} WHERE key = ?
    `);
    
    const result = stmt.run(key);
    return result.changes > 0;
  }

  /**
   * Clears cached values matching the specified criteria
   * @param options - Options for filtering which entries to clear
   * @returns Promise resolving to the number of entries cleared
   */
  async clear(options?: ClearCacheOptions): Promise<number> {
    if (!options) {
      // Clear all entries
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName}`);
      const result = stmt.run();
      return result.changes;
    }

    let sql = `DELETE FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];

    if (options.expiredOnly) {
      const now = Date.now();
      sql += ` AND expires_at IS NOT NULL AND expires_at <= ?`;
      params.push(now);
    }

    if (options.keyPattern) {
      // Convert glob pattern to SQL LIKE pattern
      const likePattern = options.keyPattern
        .replace(/\*/g, "%")
        .replace(/\?/g, "_");
      sql += ` AND key LIKE ?`;
      params.push(likePattern);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  /**
   * Gets all cached entries matching the specified criteria
   * @param options - Options for filtering entries
   * @returns Promise resolving to array of matching cache entries
   */
  async getAll(options?: GetCacheOptions): Promise<CacheEntry[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    const conditions: string[] = [];

    // Filter out expired entries unless explicitly requested
    if (options?.ignoreExpired !== false) {
      const now = Date.now();
      conditions.push(`(expires_at IS NULL OR expires_at > ?)`);
      params.push(now);
    }

    if (options?.keyPattern) {
      // Convert glob pattern to SQL LIKE pattern
      const likePattern = options.keyPattern
        .replace(/\*/g, "%")
        .replace(/\?/g, "_");
      conditions.push(`key LIKE ?`);
      params.push(likePattern);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY created_at DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    // Clean up any expired entries we found
    if (options?.ignoreExpired !== false) {
      const now = Date.now();
      const expiredStmt = this.db.prepare(`
        DELETE FROM ${this.tableName} 
        WHERE expires_at IS NOT NULL AND expires_at <= ?
      `);
      expiredStmt.run(now);
    }

    return rows.map((row) => this.rowToCacheEntry(row));
  }

  /**
   * Gets the total number of cached entries
   * @returns Promise resolving to the total cache entry count
   */
  async size(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${this.tableName}
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Removes all expired entries from the cache
   * @returns Promise resolving to the number of expired entries removed
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName} 
      WHERE expires_at IS NOT NULL AND expires_at <= ?
    `);
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Closes the database connection
   * Should be called when the cache driver is no longer needed
   */
  close(): void {
    this.db.close();
  }

  /**
   * Gets the database file path
   * @returns The database file path
   */
  getDbPath(): string {
    return this.db.filename!;
  }

  /**
   * Gets the table name used for cache entries
   * @returns The table name
   */
  getTableName(): string {
    return this.tableName;
  }
}