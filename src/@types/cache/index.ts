// CHANGELOG: [2025-06-04] - Created cache driver types for pre-request caching system

/**
 * Represents a cached value with expiration metadata
 */
export interface CacheEntry {
  /** Unique identifier for the cache entry */
  id: string;
  /** The cached value (typically response data) */
  value: any;
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Timestamp when the entry expires (optional) */
  expiresAt?: number;
  /** Key used to identify this cache entry */
  key: string;
  /** Additional metadata for the cache entry */
  metadata?: Record<string, any>;
}

/**
 * Options for getting cached values
 */
export interface GetCacheOptions {
  /** If true, ignore expired entries */
  ignoreExpired?: boolean;
  /** Key pattern to match against */
  keyPattern?: string;
}

/**
 * Options for setting cached values
 */
export interface SetCacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Explicit expiration timestamp */
  expiresAt?: number;
  /** Additional metadata to store with the entry */
  metadata?: Record<string, any>;
}

/**
 * Options for clearing cached values
 */
export interface ClearCacheOptions {
  /** Key pattern to match for clearing */
  keyPattern?: string;
  /** Clear only expired entries */
  expiredOnly?: boolean;
}