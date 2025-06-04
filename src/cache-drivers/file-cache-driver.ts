// CHANGELOG: [2025-06-05] - Updated FileCacheDriver to use file path directly instead of treating as directory
// CHANGELOG: [2025-06-05] - Modified FileCacheDriver to store all cache entries in a single file instead of separate files per request
// CHANGELOG: [2025-06-04] - Created FileCacheDriver for persistent file-based pre-request caching

import type {
  CacheEntry,
  ClearCacheOptions,
  GetCacheOptions,
  SetCacheOptions,
} from "../@types/cache/index";
import { CacheDriver } from "./base-cache-driver";

/**
 * File-based cache driver implementation
 * Stores all cache entries in a single JSON file
 * Data persists between application restarts
 * @example
 * ```typescript
 * const cache = new FileCacheDriver('./cache.json');
 * await cache.set('auth_token', 'bearer_xyz', { ttl: 3600000 });
 * const token = await cache.get('auth_token');
 * ```
 */
export class FileCacheDriver extends CacheDriver {
  private cacheFilePath: string;

  /**
   * Creates a new FileCacheDriver instance
   * @param cacheFilePath - File path where the cache will be stored as JSON
   * @example
   * ```typescript
   * const cache = new FileCacheDriver('./cache.json');
   * const interactiveCache = new FileCacheDriver('./.interactive.cache');
   * ```
   */
  constructor(cacheFilePath: string = "./cache.json") {
    super();
    this.cacheFilePath = cacheFilePath;
    this.ensureCacheFile();
  }

  /**
   * Ensures the cache file exists and initializes it if needed
   * Creates parent directory if it doesn't exist
   */
  private async ensureCacheFile(): Promise<void> {
    try {
      const file = Bun.file(this.cacheFilePath);
      if (!(await file.exists())) {
        // Create parent directory if it doesn't exist
        const parentDir = this.cacheFilePath.split('/').slice(0, -1).join('/');
        if (parentDir && parentDir !== this.cacheFilePath) {
          try {
            await Bun.$`mkdir -p "${parentDir}"`;
          } catch {
            // Ignore mkdir errors, file write will fail if directory can't be created
          }
        }
        
        // Initialize with empty cache object
        await Bun.write(this.cacheFilePath, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      console.warn(`Failed to ensure cache file: ${error}`);
    }
  }

  /**
   * Reads all cache entries from the single cache file
   * @returns Object containing all cache entries keyed by their cache key
   */
  private async readAllCacheEntries(): Promise<Record<string, CacheEntry>> {
    try {
      const file = Bun.file(this.cacheFilePath);
      if (!(await file.exists())) {
        return {};
      }

      const content = await file.text();
      const entries = JSON.parse(content) as Record<string, CacheEntry>;

      // Validate entries structure
      if (typeof entries !== 'object' || entries === null) {
        console.warn(`Invalid cache file structure: expected object`);
        return {};
      }

      return entries;
    } catch (error) {
      console.warn(`Failed to read cache file ${this.cacheFilePath}: ${error}`);
      return {};
    }
  }

  /**
   * Writes all cache entries to the single cache file
   * @param entries - Object containing all cache entries keyed by their cache key
   */
  private async writeAllCacheEntries(entries: Record<string, CacheEntry>): Promise<void> {
    try {
      await this.ensureCacheFile();
      await Bun.write(this.cacheFilePath, JSON.stringify(entries, null, 2));
    } catch (error) {
      console.warn(`Failed to write cache file ${this.cacheFilePath}: ${error}`);
      throw new Error(`Cache write failed: ${error}`);
    }
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
    const entries = await this.readAllCacheEntries();
    const entry = entries[key];

    if (!entry) {
      return undefined;
    }

    // Check if entry is expired
    const now = Date.now();
    if (entry.expiresAt && entry.expiresAt <= now) {
      // Entry is expired
      if (options?.ignoreExpired === false) {
        return entry; // Return expired entry if requested
      }
      // Remove expired entry and update file
      delete entries[key];
      try {
        await this.writeAllCacheEntries(entries);
      } catch {
        // Ignore write errors for cleanup
      }
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
    const entries = await this.readAllCacheEntries();

    const now = Date.now();
    let expiresAt: number | undefined;

    // Calculate expiration time
    if (options?.expiresAt) {
      expiresAt = options.expiresAt;
    } else if (options?.ttl) {
      expiresAt = now + options.ttl;
    }

    const entry: CacheEntry = {
      id: crypto.randomUUID(),
      key,
      value,
      createdAt: now,
      expiresAt,
      metadata: options?.metadata,
    };

    entries[key] = entry;
    await this.writeAllCacheEntries(entries);
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
    const entries = await this.readAllCacheEntries();
    
    if (!(key in entries)) {
      return false;
    }

    delete entries[key];
    
    try {
      await this.writeAllCacheEntries(entries);
      return true;
    } catch (error) {
      console.warn(`Failed to update cache file after deletion: ${error}`);
      return false;
    }
  }

  /**
   * Clears cached values matching the specified criteria
   * @param options - Options for filtering which entries to clear
   * @returns Promise resolving to the number of entries cleared
   */
  async clear(options?: ClearCacheOptions): Promise<number> {
    const entries = await this.readAllCacheEntries();
    let cleared = 0;
    const now = Date.now();

    if (!options) {
      // Clear all entries
      cleared = Object.keys(entries).length;
      await this.writeAllCacheEntries({});
      return cleared;
    }

    const keysToDelete: string[] = [];

    for (const [key, entry] of Object.entries(entries)) {
      let shouldClear = false;

      if (options.expiredOnly) {
        // Check if entry is expired
        if (entry.expiresAt && entry.expiresAt <= now) {
          shouldClear = true;
        }
      } else if (options.keyPattern) {
        // Check if key matches pattern
        const pattern = options.keyPattern.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(entry.key)) {
          shouldClear = true;
        }
      } else {
        shouldClear = true;
      }

      if (shouldClear) {
        keysToDelete.push(key);
      }
    }

    // Remove the entries that should be cleared
    for (const key of keysToDelete) {
      delete entries[key];
      cleared++;
    }

    if (cleared > 0) {
      try {
        await this.writeAllCacheEntries(entries);
      } catch (error) {
        console.warn(`Failed to update cache file after clearing: ${error}`);
      }
    }

    return cleared;
  }

  /**
   * Gets all cached entries matching the specified criteria
   * @param options - Options for filtering entries
   * @returns Promise resolving to array of matching cache entries
   */
  async getAll(options?: GetCacheOptions): Promise<CacheEntry[]> {
    const entries = await this.readAllCacheEntries();
    const results: CacheEntry[] = [];
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of Object.entries(entries)) {
      // Check if entry is expired
      const isExpired = entry.expiresAt && entry.expiresAt <= now;

      if (isExpired && options?.ignoreExpired !== false) {
        // Skip expired entries unless explicitly requested and mark for cleanup
        expiredKeys.push(key);
        continue;
      }

      // Check key pattern if specified
      if (options?.keyPattern) {
        const pattern = options.keyPattern.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(entry.key)) {
          continue;
        }
      }

      results.push(entry);
    }

    // Clean up expired entries if any were found
    if (expiredKeys.length > 0) {
      try {
        for (const key of expiredKeys) {
          delete entries[key];
        }
        await this.writeAllCacheEntries(entries);
      } catch {
        // Ignore cleanup errors
      }
    }

    return results;
  }

  /**
   * Gets the total number of cached entries
   * @returns Promise resolving to the total cache entry count
   */
  async size(): Promise<number> {
    const entries = await this.readAllCacheEntries();
    return Object.keys(entries).length;
  }

  /**
   * Removes all expired entries from the cache
   * @returns Promise resolving to the number of expired entries removed
   */
  async cleanup(): Promise<number> {
    return this.clear({ expiredOnly: true });
  }
}
