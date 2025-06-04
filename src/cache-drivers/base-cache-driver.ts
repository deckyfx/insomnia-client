// CHANGELOG: [2025-06-04] - Created base CacheDriver abstract class for pre-request caching

import type {
  CacheEntry,
  GetCacheOptions,
  SetCacheOptions,
  ClearCacheOptions,
} from "../@types/cache/index";

/**
 * Abstract base class for cache drivers
 * Provides interface for managing cached pre-request data to avoid repeated API calls
 * @example
 * ```typescript
 * class MyCacheDriver extends CacheDriver {
 *   async get(key: string): Promise<CacheEntry | undefined> {
 *     // Implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export abstract class CacheDriver {
  /**
   * Gets a cached value by key
   * @param key - The cache key to retrieve
   * @param options - Options for getting the cached value
   * @returns Promise resolving to the cache entry if found and not expired, undefined otherwise
   * @example
   * ```typescript
   * const entry = await driver.get('auth_token_user123');
   * if (entry) {
   *   console.log(`Cached value: ${entry.value}`);
   * }
   * ```
   */
  abstract get(key: string, options?: GetCacheOptions): Promise<CacheEntry | undefined>;

  /**
   * Sets a cached value
   * @param key - The cache key
   * @param value - The value to cache
   * @param options - Options for setting the cached value
   * @returns Promise resolving when the value is cached
   * @example
   * ```typescript
   * await driver.set('auth_token_user123', 'bearer_token_xyz', {
   *   ttl: 3600000, // 1 hour
   *   metadata: { userId: 'user123', scope: 'read' }
   * });
   * ```
   */
  abstract set(key: string, value: any, options?: SetCacheOptions): Promise<void>;

  /**
   * Checks if a cached value exists and is not expired
   * @param key - The cache key to check
   * @returns Promise resolving to true if the key exists and is valid, false otherwise
   * @example
   * ```typescript
   * const exists = await driver.has('auth_token_user123');
   * if (exists) {
   *   console.log('Cache hit - token is still valid');
   * }
   * ```
   */
  abstract has(key: string): Promise<boolean>;

  /**
   * Removes a specific cached value
   * @param key - The cache key to remove
   * @returns Promise resolving to true if the key was removed, false if not found
   * @example
   * ```typescript
   * const removed = await driver.delete('auth_token_user123');
   * console.log(`Cache entry removed: ${removed}`);
   * ```
   */
  abstract delete(key: string): Promise<boolean>;

  /**
   * Clears cached values matching the specified criteria
   * @param options - Options for filtering which entries to clear
   * @returns Promise resolving to the number of entries cleared
   * @example
   * ```typescript
   * // Clear all expired entries
   * const cleared = await driver.clear({ expiredOnly: true });
   * console.log(`Cleared ${cleared} expired entries`);
   *
   * // Clear entries matching pattern
   * await driver.clear({ keyPattern: 'auth_token_*' });
   * ```
   */
  abstract clear(options?: ClearCacheOptions): Promise<number>;

  /**
   * Gets all cached entries matching the specified criteria
   * @param options - Options for filtering entries
   * @returns Promise resolving to array of matching cache entries
   * @example
   * ```typescript
   * const entries = await driver.getAll({ keyPattern: 'auth_*' });
   * console.log(`Found ${entries.length} auth-related cache entries`);
   * ```
   */
  abstract getAll(options?: GetCacheOptions): Promise<CacheEntry[]>;

  /**
   * Gets the total number of cached entries
   * @returns Promise resolving to the total cache entry count
   * @example
   * ```typescript
   * const count = await driver.size();
   * console.log(`Total cache entries: ${count}`);
   * ```
   */
  abstract size(): Promise<number>;

  /**
   * Removes all expired entries from the cache
   * @returns Promise resolving to the number of expired entries removed
   * @example
   * ```typescript
   * const cleaned = await driver.cleanup();
   * console.log(`Cleaned up ${cleaned} expired cache entries`);
   * ```
   */
  abstract cleanup(): Promise<number>;
}