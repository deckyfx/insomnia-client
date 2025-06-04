// CHANGELOG: [2025-06-05] - Created SQLite cookie driver using Bun's built-in SQLite API

import { Database } from "bun:sqlite";
import type {
  Cookie,
  GetCookiesOptions,
  SetCookieOptions,
} from "../@types/cookie/index";
import { CookieDriver } from "./base-cookie-driver";

/**
 * SQLite-based cookie driver implementation
 * Stores cookies in an SQLite database using Bun's native SQLite API
 * Provides persistent cookie storage with better performance than file-based storage
 * @example
 * ```typescript
 * const cookieDriver = new SQLiteCookieDriver('./data.db');
 * await cookieDriver.setCookie('session', 'abc123', { domain: 'example.com' });
 * const cookies = await cookieDriver.getCookies({ domain: 'example.com' });
 * ```
 */
export class SQLiteCookieDriver extends CookieDriver {
  private db: Database;
  private readonly tableName = "cookies";

  /**
   * Creates a new SQLiteCookieDriver instance
   * @param dbPath - Path to the SQLite database file
   * @example
   * ```typescript
   * const cookieDriver = new SQLiteCookieDriver('./data.db');
   * ```
   */
  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initializes the database schema for cookies
   */
  private initializeDatabase(): void {
    // Create the cookies table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        domain TEXT NOT NULL,
        path TEXT NOT NULL,
        secure INTEGER NOT NULL DEFAULT 0,
        http_only INTEGER NOT NULL DEFAULT 0,
        creation TEXT NOT NULL,
        host_only INTEGER NOT NULL DEFAULT 0,
        last_accessed TEXT NOT NULL,
        expires TEXT,
        max_age INTEGER,
        same_site TEXT,
        UNIQUE(key, domain, path)
      )
    `);

    // Create indexes for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_domain 
      ON ${this.tableName}(domain)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_key_domain 
      ON ${this.tableName}(key, domain)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires 
      ON ${this.tableName}(expires)
    `);
  }

  /**
   * Converts a database row to a Cookie object
   * @param row - Database row object
   * @returns Cookie object
   */
  private rowToCookie(row: any): Cookie {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      domain: row.domain,
      path: row.path,
      secure: Boolean(row.secure),
      httpOnly: Boolean(row.http_only),
      creation: row.creation,
      hostOnly: Boolean(row.host_only),
      lastAccessed: row.last_accessed,
      expires: row.expires || undefined,
      maxAge: row.max_age || undefined,
      sameSite: row.same_site || undefined,
    };
  }

  /**
   * Checks if a cookie has expired
   * @param cookie - Cookie to check
   * @returns True if cookie has expired
   */
  private isExpired(cookie: Cookie): boolean {
    const now = Date.now();

    // Check expires field
    if (cookie.expires) {
      const expiresTime = new Date(cookie.expires).getTime();
      if (now > expiresTime) return true;
    }

    // Check maxAge field
    if (cookie.maxAge !== undefined) {
      const creationTime = new Date(cookie.creation).getTime();
      const maxAgeMs = cookie.maxAge * 1000;
      if (now > creationTime + maxAgeMs) return true;
    }

    return false;
  }

  /**
   * Removes expired cookies from the database
   * @returns Number of expired cookies removed
   */
  private cleanupExpiredCookies(): number {
    const now = new Date().toISOString();
    const nowTime = Date.now();

    // Remove cookies that have explicit expiration dates that have passed
    const expiredByDateStmt = this.db.prepare(`
      DELETE FROM ${this.tableName} 
      WHERE expires IS NOT NULL AND expires <= ?
    `);
    const expiredByDateResult = expiredByDateStmt.run(now);

    // Remove cookies that have exceeded their max age
    // We need to calculate this by checking creation + max_age
    const expiredByAgeStmt = this.db.prepare(`
      DELETE FROM ${this.tableName} 
      WHERE max_age IS NOT NULL 
      AND (strftime('%s', creation) * 1000 + max_age * 1000) <= ?
    `);
    const expiredByAgeResult = expiredByAgeStmt.run(nowTime);

    return expiredByDateResult.changes + expiredByAgeResult.changes;
  }

  /**
   * Generates a unique ID for a new cookie
   * @returns Unique cookie ID
   */
  private generateCookieId(): string {
    return `cookie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getCookies(options?: GetCookiesOptions): Promise<Cookie[]> {
    // Cleanup expired cookies first
    this.cleanupExpiredCookies();

    let sql = `SELECT * FROM ${this.tableName}`;
    const conditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (options?.domain) {
      conditions.push(`domain = ?`);
      params.push(options.domain);
    }

    if (options?.path) {
      conditions.push(`path = ?`);
      params.push(options.path);
    }

    if (options?.secure !== undefined) {
      conditions.push(`secure = ?`);
      params.push(options.secure ? 1 : 0);
    }

    if (options?.httpOnly !== undefined) {
      conditions.push(`http_only = ?`);
      params.push(options.httpOnly ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    sql += ` ORDER BY creation DESC`;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row) => this.rowToCookie(row));
  }

  async getCookie(key: string, domain: string): Promise<Cookie | undefined> {
    // Cleanup expired cookies first
    this.cleanupExpiredCookies();

    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName} 
      WHERE key = ? AND domain = ?
      ORDER BY path DESC
      LIMIT 1
    `);

    const row = stmt.get(key, domain);
    if (!row) {
      return undefined;
    }

    const cookie = this.rowToCookie(row);

    // Double-check if cookie is expired (in case cleanup missed it)
    if (this.isExpired(cookie)) {
      const deleteStmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE id = ?
      `);
      deleteStmt.run(cookie.id);
      return undefined;
    }

    return cookie;
  }

  async setCookie(
    key: string,
    value: string,
    options?: SetCookieOptions
  ): Promise<void> {
    const now = new Date().toISOString();
    const domain = options?.domain || "localhost";
    const path = options?.path || "/";

    // Check if cookie already exists to preserve ID and creation time
    const existingStmt = this.db.prepare(`
      SELECT id, creation FROM ${this.tableName} 
      WHERE key = ? AND domain = ? AND path = ?
    `);
    const existing = existingStmt.get(key, domain, path) as { id?: string; creation?: string } | null;

    const id = existing?.id || this.generateCookieId();
    const creation = existing?.creation || now;

    // Use INSERT OR REPLACE to handle updates
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tableName} 
      (id, key, value, domain, path, secure, http_only, creation, host_only, 
       last_accessed, expires, max_age, same_site)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      key,
      value,
      domain,
      path,
      options?.secure ? 1 : 0,
      options?.httpOnly ? 1 : 0,
      creation,
      options?.hostOnly ? 1 : 0,
      now,
      options?.expires || null,
      options?.maxAge || null,
      options?.sameSite || null
    );
  }

  async removeCookie(key: string, domain: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName} 
      WHERE key = ? AND domain = ?
    `);

    const result = stmt.run(key, domain);
    return result.changes > 0;
  }

  async clearCookies(options?: GetCookiesOptions): Promise<number> {
    if (!options) {
      // Clear all cookies
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName}`);
      const result = stmt.run();
      return result.changes;
    }

    let sql = `DELETE FROM ${this.tableName}`;
    const conditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (options.domain) {
      conditions.push(`domain = ?`);
      params.push(options.domain);
    }

    if (options.path) {
      conditions.push(`path = ?`);
      params.push(options.path);
    }

    if (options.secure !== undefined) {
      conditions.push(`secure = ?`);
      params.push(options.secure ? 1 : 0);
    }

    if (options.httpOnly !== undefined) {
      conditions.push(`http_only = ?`);
      params.push(options.httpOnly ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  async getCookieHeader(url: string): Promise<string> {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    const isSecure = urlObj.protocol === "https:";

    // Cleanup expired cookies first
    this.cleanupExpiredCookies();

    // Get all cookies that could apply to this URL
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE (
        (host_only = 1 AND domain = ?) OR 
        (host_only = 0 AND (? = domain OR ? LIKE '%' || domain))
      )
      AND ? LIKE path || '%'
      AND (secure = 0 OR ? = 1)
      ORDER BY LENGTH(path) DESC, creation ASC
    `);

    const rows = stmt.all(domain, domain, domain, path, isSecure ? 1 : 0);
    const applicableCookies: Cookie[] = rows.map((row) => this.rowToCookie(row));

    // Update last accessed time for applicable cookies
    const now = new Date().toISOString();
    const updateStmt = this.db.prepare(`
      UPDATE ${this.tableName} SET last_accessed = ? WHERE id = ?
    `);

    const cookiePairs: string[] = [];
    for (const cookie of applicableCookies) {
      updateStmt.run(now, cookie.id);
      cookiePairs.push(`${cookie.key}=${cookie.value}`);
    }

    return cookiePairs.join("; ");
  }

  async processSetCookieHeaders(
    setCookieHeaders: string[],
    url: string
  ): Promise<void> {
    const urlObj = new URL(url);
    const defaultDomain = urlObj.hostname;
    const defaultPath =
      urlObj.pathname.split("/").slice(0, -1).join("/") || "/";

    for (const setCookieHeader of setCookieHeaders) {
      await this.parseAndSetCookie(setCookieHeader, defaultDomain, defaultPath);
    }
  }

  /**
   * Parses a Set-Cookie header and stores the cookie
   * @param setCookieHeader - The Set-Cookie header value
   * @param defaultDomain - Default domain if not specified
   * @param defaultPath - Default path if not specified
   */
  private async parseAndSetCookie(
    setCookieHeader: string,
    defaultDomain: string,
    defaultPath: string
  ): Promise<void> {
    const parts = setCookieHeader.split(";").map((part) => part.trim());
    const [nameValue] = parts;

    if (!nameValue || !nameValue.includes("=")) return;

    const [name, ...valueParts] = nameValue.split("=");
    const value = valueParts.join("=");

    const options: SetCookieOptions = {
      domain: defaultDomain,
      path: defaultPath,
    };

    // Parse attributes
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]!;
      const [attrName, attrValue] = part.split("=").map((s) => s.trim());

      switch (attrName?.toLowerCase()) {
        case "domain":
          options.domain = attrValue?.startsWith(".")
            ? attrValue.substring(1)
            : attrValue;
          break;
        case "path":
          options.path = attrValue || "/";
          break;
        case "secure":
          options.secure = true;
          break;
        case "httponly":
          options.httpOnly = true;
          break;
        case "expires":
          options.expires = attrValue
            ? new Date(attrValue).toISOString()
            : undefined;
          break;
        case "max-age":
          options.maxAge = attrValue ? parseInt(attrValue, 10) : undefined;
          break;
        case "samesite":
          if (attrValue && ["Strict", "Lax", "None"].includes(attrValue)) {
            options.sameSite = attrValue as "Strict" | "Lax" | "None";
          }
          break;
      }
    }

    await this.setCookie(name!, value, options);
  }

  async loadFromInsomniaConfig(cookies: Cookie[]): Promise<void> {
    // Use a transaction for better performance when loading multiple cookies
    const transaction = this.db.transaction((cookies: Cookie[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${this.tableName} 
        (id, key, value, domain, path, secure, http_only, creation, host_only, 
         last_accessed, expires, max_age, same_site)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const cookie of cookies) {
        stmt.run(
          cookie.id,
          cookie.key,
          cookie.value,
          cookie.domain,
          cookie.path,
          cookie.secure ? 1 : 0,
          cookie.httpOnly ? 1 : 0,
          cookie.creation,
          cookie.hostOnly ? 1 : 0,
          cookie.lastAccessed,
          cookie.expires || null,
          cookie.maxAge || null,
          cookie.sameSite || null
        );
      }
    });

    transaction(cookies);
  }

  async getCookieCount(): Promise<number> {
    // Cleanup expired cookies first
    this.cleanupExpiredCookies();

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM ${this.tableName}
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Closes the database connection
   * Should be called when the cookie driver is no longer needed
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
   * Gets the table name used for cookies
   * @returns The table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Forces cleanup of expired cookies
   * @returns Number of expired cookies removed
   */
  async forceCleanup(): Promise<number> {
    return this.cleanupExpiredCookies();
  }
}