// CHANGELOG: [2025-06-04] - Created InsomniaClient class with flexible constructor options and configuration loading methods
// CHANGELOG: [2025-06-04] - Refactored to import types from @types directory
// CHANGELOG: [2025-06-04] - Enhanced request resolution to inherit headers and authentication from parent folders

import type {
  HttpResponse,
  InsomniaClientOptions,
  RequestOptions,
  ResolvedRequestNode,
} from "./@types/client/index";
import type { Cookie, GetCookiesOptions } from "./@types/cookie/index";
import type { EnvVariables } from "./@types/utils/index";
import { CacheDriver, InMemoryCacheDriver } from "./cache-drivers/index";
import { CookieDriver, InMemoryCookieDriver } from "./cookie-drivers/index";
import { readEnvFile } from "./utils/env";
import { parseInsomniaYaml } from "./utils/insomnia-parser";
import {
  InsomniaConfig,
  InsomniaConfigFolder,
  InsomniaConfigRequest,
} from "./utils/insomnia/index";
import { ParseScriptTemplate } from "./utils/script-template-parser";

/**
 * Main client class for interacting with Insomnia configurations
 * Supports both constructor-based and method-based configuration loading
 * @example
 * ```typescript
 * // Constructor-based initialization
 * const client = new InsomniaClient({
 *   config: '/path/to/config.yaml',
 *   env: '/path/to/.env',
 *   cookieDriver: new FileCookieDriver('./cookies'),
 *   cacheDriver: new FileCacheDriver('./cache')
 * });
 *
 * // Method-based initialization
 * const client = new InsomniaClient();
 * client.loadConfig('/path/to/config.yaml');
 * client.loadEnv('/path/to/.env');
 *
 * // Get collections
 * const collections = client.getCollections();
 * ```
 */
export class InsomniaClient {
  private config?: InsomniaConfig;
  private envVariables?: EnvVariables;
  private cookieDriver?: CookieDriver;
  private cacheDriver?: CacheDriver;
  private configPath?: string;

  /**
   * Creates a new InsomniaClient instance
   * @param options - Configuration options for the client
   * @throws {Error} When configuration files cannot be loaded
   */
  constructor(options: InsomniaClientOptions = {}) {
    // Use provided cookie driver or default to InMemoryCookieDriver
    this.cookieDriver = options.cookieDriver || new InMemoryCookieDriver();

    // Use provided cache driver or default to InMemoryCacheDriver
    this.cacheDriver = options.cacheDriver || new InMemoryCacheDriver();

    // Load configuration files if provided in constructor
    if (options.config) {
      this.loadConfig(options.config);
    }

    if (options.env) {
      this.loadEnv(options.env);
    }
  }

  /**
   * Loads Insomnia YAML configuration from the specified file path
   * @param configPath - Absolute path to the Insomnia YAML configuration file
   * @throws {Error} When configuration file cannot be parsed or loaded
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadConfig('/path/to/insomnia.yaml');
   * ```
   */
  loadConfig(configPath: string): void {
    // Store the config path for potential reloading
    this.configPath = configPath;
    // Parse the YAML configuration with current environment variables as overrides
    this.config = parseInsomniaYaml(configPath, this.envVariables);

    // Load initial cookies from Insomnia config if available
    this.loadInitialCookies();
  }

  /**
   * Loads initial cookies from the Insomnia configuration into the cookie driver
   */
  private async loadInitialCookies(): Promise<void> {
    if (this.config?.cookieJar && this.cookieDriver) {
      try {
        // Check if cookies array exists, if not, initialize empty array
        const insomniacookies = this.config.cookieJar.cookies || [];
        
        // Convert Insomnia cookies to our Cookie format
        const cookies: Cookie[] = insomniacookies.map(
          (insomniacookie) => ({
            id: insomniacookie.id,
            key: insomniacookie.key,
            value: insomniacookie.value,
            domain: insomniacookie.domain,
            path: insomniacookie.path,
            secure: insomniacookie.secure,
            httpOnly: insomniacookie.httpOnly,
            creation: insomniacookie.creation,
            hostOnly: insomniacookie.hostOnly,
            lastAccessed: insomniacookie.lastAccessed,
          })
        );

        await this.cookieDriver.loadFromInsomniaConfig(cookies);
      } catch (error) {
        console.warn(
          "Failed to load initial cookies from Insomnia config:",
          error
        );
      }
    }
  }

  /**
   * Loads environment variables from the specified file path
   * @param envPath - Absolute path to the environment variables file
   * @throws {Error} When environment file cannot be read or parsed
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadEnv('/path/to/.env');
   * ```
   */
  loadEnv(envPath: string): void {
    // Read environment variables from file
    this.envVariables = readEnvFile({ path: envPath, required: true });

    // If config is already loaded, automatically reload it with new environment variables
    if (this.config && this.configPath) {
      console.log(
        "🔄 Reloading configuration with new environment variables..."
      );
      this.config = parseInsomniaYaml(this.configPath, this.envVariables);
    }
  }

  /**
   * Returns all request node paths from the loaded configuration
   * Request nodes are identified by having a 'url' property
   * @returns Array of request node paths (e.g., "API/Home/Get User") or empty array if no config loaded
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadConfig('/path/to/config.yaml');
   * const paths = client.getRequestNodePaths();
   * // Result: ["API/Home/Get User", "API/Home/Get User Granted Features"]
   * ```
   */
  getRequestNodePaths(): string[] {
    // Return empty array if no configuration is loaded
    if (!this.config) {
      return [];
    }

    // Recursively collect request nodes with their full paths
    return this.collectRequestNodes(this.config.collection.items, []);
  }

  /**
   * Finds the path to a request by its ID
   * @param requestId - The ID of the request to find
   * @returns The full path to the request or undefined if not found
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadConfig('/path/to/config.yaml');
   * const path = client.findRequestPathById('req_aa2b49e9eb5245668058013f565d533a');
   * // Result: "API/Auth/Login"
   * ```
   */
  findRequestPathById(requestId: string): string | undefined {
    if (!this.config) {
      return undefined;
    }

    return this.findRequestPathByIdRecursive(this.config.collection.items, requestId, []);
  }

  /**
   * Recursively finds a request by its ID and returns the full path
   * @param items - Array of folders and requests to search in
   * @param requestId - The ID of the request to find
   * @param pathSegments - Current path segments accumulated during traversal
   * @returns The full path to the request or undefined if not found
   */
  private findRequestPathByIdRecursive(
    items: (InsomniaConfigFolder | InsomniaConfigRequest)[],
    requestId: string,
    pathSegments: string[]
  ): string | undefined {
    for (const item of items) {
      if (item instanceof InsomniaConfigRequest) {
        // Check if this request has the matching ID
        if (item.meta.id === requestId) {
          const fullPath = [...pathSegments, item.name].join("/");
          return fullPath;
        }
      } else if (item instanceof InsomniaConfigFolder) {
        // This is a folder - recursively search its children
        const newPathSegments = [...pathSegments, item.name];
        const found = this.findRequestPathByIdRecursive(
          item.children,
          requestId,
          newPathSegments
        );
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  /**
   * Recursively collects request nodes (requests with URLs) with their full paths
   * @param items - Array of folders and requests to traverse
   * @param pathSegments - Current path segments accumulated during traversal
   * @returns Array of full paths to request nodes
   */
  private collectRequestNodes(
    items: (InsomniaConfigFolder | InsomniaConfigRequest)[],
    pathSegments: string[]
  ): string[] {
    const requestNodes: string[] = [];

    for (const item of items) {
      if (item instanceof InsomniaConfigRequest) {
        // This is a request node (has URL property) - add the full path
        const fullPath = [...pathSegments, item.name].join("/");
        requestNodes.push(fullPath);
      } else if (item instanceof InsomniaConfigFolder) {
        // This is a folder - recursively traverse its children
        const newPathSegments = [...pathSegments, item.name];
        requestNodes.push(
          ...this.collectRequestNodes(item.children, newPathSegments)
        );
      }
    }

    return requestNodes;
  }

  /**
   * Gets a request node by providing its full path with resolved template variables and inherited configs
   * @param path - The full path to the request node (e.g., "API/Home/Get User")
   * @returns Object with resolved request data including inherited headers and authentication, or undefined if not found
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadConfig('/path/to/config.yaml');
   * const request = client.getRequestNode('API/Home/Get User');
   * if (request) {
   *   console.log(`Found request: ${request.name} (${request.method})`);
   *   console.log(`URL: ${request.url}`); // Template variables resolved
   *   console.log(`Headers: ${request.headers.length}`); // Includes inherited headers
   * }
   * ```
   */
  getRequestNode(path: string): ResolvedRequestNode | undefined {
    // Return undefined if no configuration is loaded
    if (!this.config) {
      return undefined;
    }

    // Split the path into segments
    const pathSegments = path
      .split("/")
      .filter((segment) => segment.trim() !== "");

    // If no segments, return undefined
    if (pathSegments.length === 0) {
      return undefined;
    }

    // Find the raw request node and collect parent folders along the path
    const { request: rawRequest, parentFolders } =
      this.findRequestNodeWithParents(
        this.config.collection.items,
        pathSegments
      );
    if (!rawRequest) {
      return undefined;
    }

    // Resolve inherited headers and authentication from parent folders
    const inheritedConfig = this.resolveInheritedConfig(parentFolders);

    // Get template resolver for resolving variables
    const resolver = this.config.createTemplateResolver();

    // Resolve request's own data
    const resolvedData = this.config.resolveRequest(rawRequest);
    const sanitizedUrl = rawRequest.getResolvedSanitizedUrl(resolver);

    // Merge inherited headers with request's own headers (request headers take priority)
    const mergedHeaders = this.mergeHeaders(
      inheritedConfig.headers,
      resolvedData.headers
    );

    // Use inherited authentication if request doesn't have its own
    const finalAuthentication = rawRequest.authentication
      ? {
          type: rawRequest.authentication.type,
          token: rawRequest.authentication.token,
          username: rawRequest.authentication.username,
          password: rawRequest.authentication.password,
          disabled: rawRequest.authentication.isDisabled(),
        }
      : inheritedConfig.authentication;

    // Combine resolved data with inherited configs
    return {
      name: rawRequest.name,
      method: rawRequest.method,
      url: sanitizedUrl,
      headers: mergedHeaders,
      body: resolvedData.body,
      authentication: finalAuthentication,
      meta: {
        id: rawRequest.meta.id,
        created: rawRequest.meta.created,
        modified: rawRequest.meta.modified,
        isPrivate: rawRequest.meta.isPrivate,
        sortKey: rawRequest.meta.sortKey,
      },
    };
  }

  /**
   * Recursively finds a request node by traversing the path segments and collects parent folders
   * @param items - Array of folders and requests to search in
   * @param pathSegments - Remaining path segments to traverse
   * @param parentFolders - Accumulated parent folders along the path
   * @returns Object with the request and array of parent folders, or undefined if not found
   */
  private findRequestNodeWithParents(
    items: (InsomniaConfigFolder | InsomniaConfigRequest)[],
    pathSegments: string[],
    parentFolders: InsomniaConfigFolder[] = []
  ):
    | { request: InsomniaConfigRequest; parentFolders: InsomniaConfigFolder[] }
    | { request: undefined; parentFolders: never[] } {
    // If no more path segments, we shouldn't be here
    if (pathSegments.length === 0) {
      return { request: undefined, parentFolders: [] };
    }

    const currentSegment = pathSegments[0]!;
    const remainingSegments = pathSegments.slice(1);

    // Find the item that matches the current segment
    for (const item of items) {
      if (item.name === currentSegment) {
        // If this is the last segment, it should be a request (request node)
        if (remainingSegments.length === 0) {
          if (item instanceof InsomniaConfigRequest) {
            return { request: item, parentFolders };
          }
          return { request: undefined, parentFolders: [] };
        }

        // If there are more segments, this should be a folder
        if (item instanceof InsomniaConfigFolder) {
          return this.findRequestNodeWithParents(
            item.children,
            remainingSegments,
            [...parentFolders, item]
          );
        }

        // If we have more segments but this is a request, path is invalid
        return { request: undefined, parentFolders: [] };
      }
    }

    // No matching item found for current segment
    return { request: undefined, parentFolders: [] };
  }

  /**
   * Recursively finds a request node by traversing the path segments (legacy method for backward compatibility)
   * @param items - Array of folders and requests to search in
   * @param pathSegments - Remaining path segments to traverse
   * @returns The InsomniaConfigRequest if found, undefined otherwise
   */
  private findRequestNodeByPath(
    items: (InsomniaConfigFolder | InsomniaConfigRequest)[],
    pathSegments: string[]
  ): InsomniaConfigRequest | undefined {
    const result = this.findRequestNodeWithParents(items, pathSegments);
    return result.request;
  }

  /**
   * Resolves inherited configuration from parent folders
   * @param parentFolders - Array of parent folders in order from root to immediate parent
   * @returns Object with merged headers and authentication from all parent folders
   */
  private resolveInheritedConfig(parentFolders: InsomniaConfigFolder[]): {
    headers: Array<{ name?: string; value?: string; disabled?: boolean }>;
    authentication?: {
      type: string;
      token?: string;
      username?: string;
      password?: string;
      disabled?: boolean;
    };
  } {
    const resolver = this.config?.createTemplateResolver();
    const inheritedHeaders: Array<{
      name?: string;
      value?: string;
      disabled?: boolean;
    }> = [];
    let inheritedAuth: any = undefined;

    // Process parent folders from root to immediate parent
    for (const folder of parentFolders) {
      // Collect headers from this folder
      if (folder.headers) {
        for (const header of folder.headers) {
          if (!header.disabled && header.name && header.value) {
            inheritedHeaders.push({
              name: resolver ? resolver.resolve(header.name) : header.name,
              value: resolver ? resolver.resolve(header.value) : header.value,
              disabled: header.disabled,
            });
          }
        }
      }

      // Use authentication from the deepest parent folder that has it
      if (folder.authentication && !folder.authentication.isDisabled()) {
        inheritedAuth = {
          type: folder.authentication.type,
          token: folder.authentication.token
            ? resolver
              ? resolver.resolve(folder.authentication.token)
              : folder.authentication.token
            : undefined,
          username: folder.authentication.username
            ? resolver
              ? resolver.resolve(folder.authentication.username)
              : folder.authentication.username
            : undefined,
          password: folder.authentication.password
            ? resolver
              ? resolver.resolve(folder.authentication.password)
              : folder.authentication.password
            : undefined,
          disabled: folder.authentication.isDisabled(),
        };
      }
    }

    return {
      headers: inheritedHeaders,
      authentication: inheritedAuth,
    };
  }

  /**
   * Merges inherited headers with request headers, giving priority to request headers
   * @param inheritedHeaders - Headers inherited from parent folders
   * @param requestHeaders - Headers defined on the request itself
   * @returns Merged array of headers with request headers taking priority
   */
  private mergeHeaders(
    inheritedHeaders: Array<{
      name?: string;
      value?: string;
      disabled?: boolean;
    }>,
    requestHeaders: Array<{ name?: string; value?: string; disabled?: boolean }>
  ): Array<{ name?: string; value?: string; disabled?: boolean }> {
    const merged: Array<{ name?: string; value?: string; disabled?: boolean }> =
      [];
    const requestHeaderNames = new Set<string>();

    // First, add all request headers and track their names
    for (const header of requestHeaders) {
      if (header.name) {
        requestHeaderNames.add(header.name.toLowerCase());
        merged.push(header);
      }
    }

    // Then, add inherited headers that don't conflict with request headers
    for (const header of inheritedHeaders) {
      if (header.name && !requestHeaderNames.has(header.name.toLowerCase())) {
        merged.push(header);
      }
    }

    return merged;
  }

  /**
   * Adds authentication headers to the request headers based on authentication configuration
   * @param headers - The headers object to add authentication headers to
   * @param authentication - The authentication configuration
   */
  private addAuthenticationHeaders(
    headers: Record<string, string>,
    authentication: {
      type: string;
      token?: string;
      username?: string;
      password?: string;
      disabled?: boolean;
    }
  ): void {
    if (authentication.disabled) {
      return;
    }

    switch (authentication.type.toLowerCase()) {
      case "basic":
        if (authentication.username && authentication.password) {
          const credentials = btoa(
            `${authentication.username}:${authentication.password}`
          );
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;

      case "bearer":
      case "oauth2":
        if (authentication.token) {
          headers["Authorization"] = `Bearer ${authentication.token}`;
        }
        break;

      case "apikey":
        // API key authentication can be in header or query param
        // For now, we'll assume it's in Authorization header
        if (authentication.token) {
          headers["Authorization"] = authentication.token;
        }
        break;

      default:
        // For unknown types, if token is provided, use it as Authorization header
        if (authentication.token) {
          headers["Authorization"] = authentication.token;
        }
        break;
    }
  }

  /**
   * Returns the loaded configuration object
   * @returns The loaded InsomniaConfig or undefined if not loaded
   */
  getConfig(): InsomniaConfig | undefined {
    return this.config;
  }

  /**
   * Returns the loaded environment variables
   * @returns The loaded environment variables or undefined if not loaded
   */
  getEnvVariables(): EnvVariables | undefined {
    return this.envVariables;
  }

  /**
   * Returns the cookie driver instance
   * @returns The cookie driver or undefined if not set
   */
  getCookieDriver(): CookieDriver | undefined {
    return this.cookieDriver;
  }

  /**
   * Sets the cookie driver instance
   * @param cookieDriver - The cookie driver to use for cookie management
   */
  setCookieDriver(cookieDriver: CookieDriver): void {
    this.cookieDriver = cookieDriver;
    // Load initial cookies if config is already loaded
    if (this.config) {
      this.loadInitialCookies();
    }
  }

  /**
   * Returns the cache driver instance
   * @returns The cache driver or undefined if not set
   */
  getCacheDriver(): CacheDriver | undefined {
    return this.cacheDriver;
  }

  /**
   * Sets the cache driver instance
   * @param cacheDriver - The cache driver to use for pre-request caching
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.setCacheDriver(new FileCacheDriver('./cache'));
   * ```
   */
  setCacheDriver(cacheDriver: CacheDriver): void {
    this.cacheDriver = cacheDriver;
  }

  /**
   * Gets all cookies matching the specified criteria
   * @param options - Options for filtering cookies
   * @returns Promise resolving to array of matching cookies
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const cookies = await client.getCookies({ domain: 'example.com' });
   * console.log(`Found ${cookies.length} cookies for example.com`);
   * ```
   */
  async getCookies(options?: GetCookiesOptions): Promise<Cookie[]> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.getCookies(options);
  }

  /**
   * Gets a specific cookie by key and domain
   * @param key - The cookie name/key
   * @param domain - The domain to search in
   * @returns Promise resolving to the cookie if found, undefined otherwise
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const sessionCookie = await client.getCookie('session', 'example.com');
   * if (sessionCookie) {
   *   console.log(`Session: ${sessionCookie.value}`);
   * }
   * ```
   */
  async getCookie(key: string, domain: string): Promise<Cookie | undefined> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.getCookie(key, domain);
  }

  /**
   * Sets or updates a cookie
   * @param key - The cookie name/key
   * @param value - The cookie value
   * @param options - Additional cookie options
   * @returns Promise resolving when the cookie is set
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * await client.setCookie('session', 'abc123', {
   *   domain: 'example.com',
   *   path: '/',
   *   secure: true,
   *   httpOnly: true
   * });
   * ```
   */
  async setCookie(key: string, value: string, options?: any): Promise<void> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.setCookie(key, value, options);
  }

  /**
   * Removes a specific cookie
   * @param key - The cookie name/key to remove
   * @param domain - The domain to remove from
   * @returns Promise resolving to true if cookie was removed, false if not found
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const removed = await client.removeCookie('session', 'example.com');
   * console.log(`Cookie removed: ${removed}`);
   * ```
   */
  async removeCookie(key: string, domain: string): Promise<boolean> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.removeCookie(key, domain);
  }

  /**
   * Clears all cookies matching the specified criteria
   * @param options - Options for filtering which cookies to clear
   * @returns Promise resolving to the number of cookies cleared
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * // Clear all cookies for a domain
   * const cleared = await client.clearCookies({ domain: 'example.com' });
   * console.log(`Cleared ${cleared} cookies`);
   * ```
   */
  async clearCookies(options?: GetCookiesOptions): Promise<number> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.clearCookies(options);
  }

  /**
   * Gets cookies formatted as HTTP Cookie header value for a specific URL
   * @param url - The URL to get cookies for
   * @returns Promise resolving to Cookie header value (e.g., "key1=value1; key2=value2")
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const cookieHeader = await client.getCookieHeader('https://example.com/api');
   * // Result: "session=abc123; csrf=def456"
   * ```
   */
  async getCookieHeader(url: string): Promise<string> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.getCookieHeader(url);
  }

  /**
   * Parses and stores cookies from Set-Cookie response headers
   * @param setCookieHeaders - Array of Set-Cookie header values
   * @param url - The URL that sent the cookies
   * @returns Promise resolving when all cookies are processed
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const setCookieHeaders = [
   *   'session=abc123; Path=/; Secure; HttpOnly',
   *   'csrf=def456; Path=/; SameSite=Strict'
   * ];
   * await client.processSetCookieHeaders(setCookieHeaders, 'https://example.com');
   * ```
   */
  async processSetCookieHeaders(
    setCookieHeaders: string[],
    url: string
  ): Promise<void> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.processSetCookieHeaders(setCookieHeaders, url);
  }

  /**
   * Gets the total number of stored cookies
   * @returns Promise resolving to the total cookie count
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const count = await client.getCookieCount();
   * console.log(`Total cookies: ${count}`);
   * ```
   */
  async getCookieCount(): Promise<number> {
    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }
    return this.cookieDriver.getCookieCount();
  }

  /**
   * Gets a cached pre-request value by key
   * @param key - The cache key to retrieve
   * @returns Promise resolving to the cached value if found and not expired, undefined otherwise
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const token = await client.getCachedValue('auth_token_user123');
   * if (token) {
   *   console.log(`Using cached auth token: ${token}`);
   * }
   * ```
   */
  async getCachedValue(key: string): Promise<any> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    const entry = await this.cacheDriver.get(key);
    return entry?.value;
  }

  /**
   * Sets a cached pre-request value
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttl - Time to live in milliseconds (optional)
   * @returns Promise resolving when the value is cached
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * // Cache auth token for 1 hour
   * await client.setCachedValue('auth_token_user123', 'bearer_xyz', 3600000);
   * ```
   */
  async setCachedValue(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    await this.cacheDriver.set(key, value, ttl ? { ttl } : undefined);
  }

  /**
   * Checks if a cached value exists and is not expired
   * @param key - The cache key to check
   * @returns Promise resolving to true if the key exists and is valid, false otherwise
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const hasToken = await client.hasCachedValue('auth_token_user123');
   * if (!hasToken) {
   *   // Need to perform pre-request to get fresh token
   * }
   * ```
   */
  async hasCachedValue(key: string): Promise<boolean> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    return this.cacheDriver.has(key);
  }

  /**
   * Removes a specific cached value
   * @param key - The cache key to remove
   * @returns Promise resolving to true if the key was removed, false if not found
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const removed = await client.deleteCachedValue('auth_token_user123');
   * console.log(`Cache entry removed: ${removed}`);
   * ```
   */
  async deleteCachedValue(key: string): Promise<boolean> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    return this.cacheDriver.delete(key);
  }

  /**
   * Clears all cached values
   * @returns Promise resolving to the number of entries cleared
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const cleared = await client.clearCache();
   * console.log(`Cleared ${cleared} cache entries`);
   * ```
   */
  async clearCache(): Promise<number> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    return this.cacheDriver.clear();
  }

  /**
   * Removes all expired cache entries
   * @returns Promise resolving to the number of expired entries removed
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * const cleaned = await client.cleanupCache();
   * console.log(`Cleaned up ${cleaned} expired cache entries`);
   * ```
   */
  async cleanupCache(): Promise<number> {
    if (!this.cacheDriver) {
      throw new Error("Cache driver not initialized");
    }
    return this.cacheDriver.cleanup();
  }

  /**
   * Executes an HTTP request for a specific request node path
   * @param path - The full path to the request node (e.g., "Sample/Google")
   * @param options - Optional request options to override defaults
   * @returns Promise resolving to the HTTP response
   * @example
   * ```typescript
   * const client = new InsomniaClient();
   * client.loadConfig('./insomnia.yaml');
   *
   * // Basic request
   * const response = await client.request('Sample/Google');
   * console.log(`Status: ${response.status}`);
   * console.log(`Body: ${response.body}`);
   *
   * // Request with custom options
   * const response2 = await client.request('API/Home/Get User', {
   *   headers: { 'Authorization': 'Bearer token123' },
   *   timeout: 5000
   * });
   * ```
   */
  async request(path: string, options?: RequestOptions): Promise<HttpResponse> {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }

    if (!this.cookieDriver) {
      throw new Error("Cookie driver not initialized");
    }

    // Get the resolved request node
    let requestNode = this.getRequestNode(path);
    if (!requestNode) {
      throw new Error(`Request node not found at path: ${path}`);
    }

    requestNode = await ParseScriptTemplate(requestNode, this);

    const startTime = Date.now();

    try {
      // Prepare headers
      const headers: Record<string, string> = {};

      // Add headers from request node
      if (requestNode.headers) {
        for (const header of requestNode.headers) {
          if (header.name && header.value && !header.disabled) {
            headers[header.name] = header.value;
          }
        }
      }

      // Add custom headers from options (these override request node headers)
      if (options?.headers) {
        Object.assign(headers, options.headers);
      }

      // Add authentication headers if available
      if (requestNode.authentication && !requestNode.authentication.disabled) {
        this.addAuthenticationHeaders(headers, requestNode.authentication);
      }

      // URL is already sanitized from getRequestNode method
      const url = requestNode.url;

      // Add cookies if enabled
      const sendCookies = options?.sendCookies !== false; // Default to true
      if (sendCookies) {
        const cookieHeader = await this.cookieDriver.getCookieHeader(url);
        if (cookieHeader) {
          headers["Cookie"] = cookieHeader;
        }
      }

      // Prepare request body
      let body: string | undefined;
      if (options?.body) {
        body = options.body;
      } else if (requestNode.body?.text) {
        body = requestNode.body.text;
      } else if (requestNode.body?.params) {
        // Handle form data
        const formData = new URLSearchParams();
        for (const param of requestNode.body.params) {
          if (!param.disabled) {
            formData.append(param.name, param.value);
          }
        }
        body = formData.toString();
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
      }

      // Make the HTTP request using fetch
      const fetchOptions: RequestInit = {
        method: requestNode.method,
        headers,
        body,
        redirect: options?.followRedirects !== false ? "follow" : "manual",
      };

      // Add timeout if specified
      const controller = new AbortController();
      if (options?.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
        fetchOptions.signal = controller.signal;
      }

      const response = await fetch(url, fetchOptions);
      const responseBody = await response.text();
      const duration = Date.now() - startTime;

      // Process Set-Cookie headers if cookie storage is enabled
      const storeCookies = options?.storeCookies !== false; // Default to true
      if (storeCookies) {
        const setCookieHeaders = response.headers.getSetCookie?.() || [];
        if (setCookieHeaders.length > 0) {
          await this.cookieDriver.processSetCookieHeaders(
            setCookieHeaders,
            url
          );
        }
      }

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Try to parse JSON if applicable
      let json: any;
      const contentType = responseHeaders["content-type"]?.toLowerCase() || "";
      if (contentType.includes("application/json")) {
        try {
          json = JSON.parse(responseBody);
        } catch {
          // Not valid JSON, leave as undefined
        }
      }

      const httpResponse: HttpResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        requestHeaders: headers,
        body: responseBody,
        json,
        url,
        method: requestNode.method,
        duration,
        ok: response.ok,
      };

      return httpResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error) {
        // Handle timeout and network errors
        if (error.name === "AbortError") {
          throw new Error(
            `Request timeout after ${options?.timeout || "unknown"}ms`
          );
        }
        throw new Error(`HTTP request failed: ${error.message}`);
      }

      throw new Error(`HTTP request failed: ${String(error)}`);
    }
  }
}
