// CHANGELOG: [2025-06-04] - Created centralized client type definitions

// CookieDriver is imported from the cookie-drivers module as it's a class, not a type

/**
 * HTTP response interface
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Request headers that were sent */
  requestHeaders: Record<string, string>;
  /** Response body as text */
  body: string;
  /** Response body as JSON (if applicable) */
  json?: any;
  /** Request URL that was called */
  url: string;
  /** Request method used */
  method: string;
  /** Time taken for the request in milliseconds */
  duration: number;
  /** Whether the request was successful (status 200-299) */
  ok: boolean;
}

/**
 * Options for HTTP requests
 */
export interface RequestOptions {
  /** Custom headers to add/override */
  headers?: Record<string, string>;
  /** Request body */
  body?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to follow redirects */
  followRedirects?: boolean;
  /** Whether to send cookies */
  sendCookies?: boolean;
  /** Whether to store cookies from response */
  storeCookies?: boolean;
}

/**
 * Resolved request node with inherited configurations and template variables resolved
 */
export interface ResolvedRequestNode {
  /** Request name */
  name: string;
  /** HTTP method */
  method: string;
  /** Resolved URL with template variables */
  url: string;
  /** Headers including inherited ones from parent folders */
  headers: Array<{ name?: string; value?: string; disabled?: boolean }>;
  /** Request body configuration */
  body?: {
    mimeType: string;
    text?: string;
    params?: Array<{ name: string; value: string; disabled: boolean }>;
  };
  /** Authentication configuration (inherited if not defined on request) */
  authentication?: {
    type: string;
    token?: string;
    username?: string;
    password?: string;
    disabled?: boolean;
  };
  /** Request metadata */
  meta: {
    id: string;
    created: number;
    modified: number;
    isPrivate?: boolean;
    sortKey?: number;
  };
}

/**
 * Configuration options for InsomniaClient constructor
 */
export interface InsomniaClientOptions {
  /** Path to Insomnia YAML configuration file */
  config?: string;
  /** Path to environment variables file */
  env?: string;
  /** Cookie driver instance for cookie management */
  cookieDriver?: any; // CookieDriver class import is handled in implementation files
  /** Cache driver instance for pre-request caching */
  cacheDriver?: any; // CacheDriver class import is handled in implementation files
}