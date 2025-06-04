// CHANGELOG: [2025-06-04] - Created InMemoryCacheDriver for in-memory pre-request caching

import type {
  CacheEntry,
  GetCacheOptions,
  SetCacheOptions,
  ClearCacheOptions,
} from "../@types/cache/index";
import { CacheDriver } from "./base-cache-driver";

/**
 * In-memory cache driver implementation
 * Stores cache entries in memory - data is lost when the application restarts
 * Ideal for temporary caching during a single session
 * @example
 * ```typescript
 * const cache = new InMemoryCacheDriver();
 * await cache.set('auth_token', 'bearer_xyz', { ttl: 3600000 });
 * const token = await cache.get('auth_token');
 * ```
 */
export class InMemoryCacheDriver extends CacheDriver {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Gets a cached value by key
   * @param key - The cache key to retrieve
   * @param options - Options for getting the cached value
   * @returns Promise resolving to the cache entry if found and not expired, undefined otherwise
   */
  async get(key: string, options?: GetCacheOptions): Promise<CacheEntry | undefined> {
    const entry = this.cache.get(key);
    
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
      // Remove expired entry and return undefined
      this.cache.delete(key);
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

    const entry: CacheEntry = {
      id: crypto.randomUUID(),
      key,
      value,
      createdAt: now,
      expiresAt,
      metadata: options?.metadata,
    };

    this.cache.set(key, entry);
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
    return this.cache.delete(key);
  }

  /**
   * Clears cached values matching the specified criteria
   * @param options - Options for filtering which entries to clear
   * @returns Promise resolving to the number of entries cleared
   */
  async clear(options?: ClearCacheOptions): Promise<number> {
    const before = this.cache.size;

    if (!options) {
      // Clear all entries
      this.cache.clear();
      return before;
    }

    let cleared = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      let shouldClear = false;

      // Check if only clearing expired entries
      if (options.expiredOnly) {
        if (entry.expiresAt && entry.expiresAt <= now) {
          shouldClear = true;
        }
      } else if (options.keyPattern) {
        // Check if key matches pattern (simple wildcard support with *)
        const pattern = options.keyPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(key)) {
          shouldClear = true;
        }
      } else {
        // No specific options, clear all
        shouldClear = true;
      }

      if (shouldClear) {
        this.cache.delete(key);
        cleared++;
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
    const entries: CacheEntry[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      // Check if entry is expired
      const isExpired = entry.expiresAt && entry.expiresAt <= now;
      
      if (isExpired && options?.ignoreExpired !== false) {
        // Skip expired entries unless explicitly requested
        this.cache.delete(key); // Clean up expired entries
        continue;
      }

      // Check key pattern if specified
      if (options?.keyPattern) {
        const pattern = options.keyPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(key)) {
          continue;
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Gets the total number of cached entries
   * @returns Promise resolving to the total cache entry count
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Removes all expired entries from the cache
   * @returns Promise resolving to the number of expired entries removed
   */
  async cleanup(): Promise<number> {
    return this.clear({ expiredOnly: true });
  }
}