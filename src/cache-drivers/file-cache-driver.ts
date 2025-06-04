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
 * Stores cache entries as JSON files in a specified directory
 * Data persists between application restarts
 * @example
 * ```typescript
 * const cache = new FileCacheDriver('./cache');
 * await cache.set('auth_token', 'bearer_xyz', { ttl: 3600000 });
 * const token = await cache.get('auth_token');
 * ```
 */
export class FileCacheDriver extends CacheDriver {
  private cacheDir: string;

  /**
   * Creates a new FileCacheDriver instance
   * @param cacheDir - Directory path where cache files will be stored
   * @example
   * ```typescript
   * const cache = new FileCacheDriver('./cache');
   * ```
   */
  constructor(cacheDir: string = "./.cache") {
    super();
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  /**
   * Ensures the cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await Bun.write(`${this.cacheDir}/.gitkeep`, "");
    } catch (error) {
      // Directory creation failed or file write failed
      console.warn(`Failed to ensure cache directory: ${error}`);
    }
  }

  /**
   * Gets the file path for a cache key
   * @param key - The cache key
   * @returns The full file path for the cache entry
   */
  private getFilePath(key: string): string {
    // Create a safe filename from the key by replacing unsafe characters
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${this.cacheDir}/${safeKey}.json`;
  }

  /**
   * Reads a cache entry from file
   * @param filePath - The file path to read from
   * @returns The cache entry or undefined if file doesn't exist or is invalid
   */
  private async readCacheFile(
    filePath: string
  ): Promise<CacheEntry | undefined> {
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return undefined;
      }

      const content = await file.text();
      const entry = JSON.parse(content) as CacheEntry;

      // Validate entry structure
      if (!entry.id || !entry.key || entry.createdAt === undefined) {
        console.warn(`Invalid cache entry structure in file: ${filePath}`);
        return undefined;
      }

      return entry;
    } catch (error) {
      console.warn(`Failed to read cache file ${filePath}: ${error}`);
      return undefined;
    }
  }

  /**
   * Writes a cache entry to file
   * @param filePath - The file path to write to
   * @param entry - The cache entry to write
   */
  private async writeCacheFile(
    filePath: string,
    entry: CacheEntry
  ): Promise<void> {
    try {
      await Bun.write(filePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      console.warn(`Failed to write cache file ${filePath}: ${error}`);
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
    const filePath = this.getFilePath(key);
    const entry = await this.readCacheFile(filePath);

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
      // Remove expired entry file and return undefined
      try {
        await Bun.write(filePath, ""); // Clear file
      } catch {
        // Ignore deletion errors
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
    await this.ensureCacheDir();

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

    const filePath = this.getFilePath(key);
    await this.writeCacheFile(filePath, entry);
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
    const filePath = this.getFilePath(key);
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        return false;
      }

      // Clear the file content instead of deleting to avoid permission issues
      await Bun.write(filePath, "");
      return true;
    } catch (error) {
      console.warn(`Failed to delete cache file ${filePath}: ${error}`);
      return false;
    }
  }

  /**
   * Gets all cache files in the cache directory
   * @returns Array of cache file paths
   */
  private async getCacheFiles(): Promise<string[]> {
    try {
      const globber = new Bun.Glob("*.json");
      const files: string[] = [];

      for await (const file of globber.scan(this.cacheDir)) {
        files.push(`${this.cacheDir}/${file}`);
      }

      return files;
    } catch (error) {
      console.warn(`Failed to list cache files: ${error}`);
      return [];
    }
  }

  /**
   * Clears cached values matching the specified criteria
   * @param options - Options for filtering which entries to clear
   * @returns Promise resolving to the number of entries cleared
   */
  async clear(options?: ClearCacheOptions): Promise<number> {
    const files = await this.getCacheFiles();
    let cleared = 0;
    const now = Date.now();

    for (const filePath of files) {
      let shouldClear = false;

      if (!options) {
        // Clear all files
        shouldClear = true;
      } else {
        const entry = await this.readCacheFile(filePath);
        if (!entry) continue;

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
      }

      if (shouldClear) {
        try {
          await Bun.write(filePath, "");
          cleared++;
        } catch (error) {
          console.warn(`Failed to clear cache file ${filePath}: ${error}`);
        }
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
    const files = await this.getCacheFiles();
    const entries: CacheEntry[] = [];
    const now = Date.now();

    for (const filePath of files) {
      const entry = await this.readCacheFile(filePath);
      if (!entry) continue;

      // Check if entry is expired
      const isExpired = entry.expiresAt && entry.expiresAt <= now;

      if (isExpired && options?.ignoreExpired !== false) {
        // Skip expired entries unless explicitly requested
        try {
          await Bun.write(filePath, ""); // Clean up expired entries
        } catch {
          // Ignore cleanup errors
        }
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

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Gets the total number of cached entries
   * @returns Promise resolving to the total cache entry count
   */
  async size(): Promise<number> {
    const files = await this.getCacheFiles();
    let count = 0;

    for (const filePath of files) {
      const entry = await this.readCacheFile(filePath);
      if (entry) {
        count++;
      }
    }

    return count;
  }

  /**
   * Removes all expired entries from the cache
   * @returns Promise resolving to the number of expired entries removed
   */
  async cleanup(): Promise<number> {
    return this.clear({ expiredOnly: true });
  }
}
