// CHANGELOG: [2025-06-04] - Created base CookieDriver abstract class for cookie management
// CHANGELOG: [2025-06-04] - Refactored to import types from @types directory

import type {
  Cookie,
  GetCookiesOptions,
  SetCookieOptions,
} from "../@types/cookie/index";

/**
 * Abstract base class for cookie drivers
 * Provides interface for managing cookies during HTTP request sessions
 */
export abstract class CookieDriver {
  /**
   * Gets all cookies matching the specified criteria
   * @param options - Options for filtering cookies
   * @returns Promise resolving to array of matching cookies
   * @example
   * ```typescript
   * const cookies = await driver.getCookies({ domain: 'example.com' });
   * console.log(`Found ${cookies.length} cookies for example.com`);
   * ```
   */
  abstract getCookies(options?: GetCookiesOptions): Promise<Cookie[]>;

  /**
   * Gets a specific cookie by key and domain
   * @param key - The cookie name/key
   * @param domain - The domain to search in
   * @returns Promise resolving to the cookie if found, undefined otherwise
   * @example
   * ```typescript
   * const sessionCookie = await driver.getCookie('session', 'example.com');
   * if (sessionCookie) {
   *   console.log(`Session: ${sessionCookie.value}`);
   * }
   * ```
   */
  abstract getCookie(key: string, domain: string): Promise<Cookie | undefined>;

  /**
   * Sets or updates a cookie
   * @param key - The cookie name/key
   * @param value - The cookie value
   * @param options - Additional cookie options
   * @returns Promise resolving when the cookie is set
   * @example
   * ```typescript
   * await driver.setCookie('session', 'abc123', {
   *   domain: 'example.com',
   *   path: '/',
   *   secure: true,
   *   httpOnly: true
   * });
   * ```
   */
  abstract setCookie(
    key: string,
    value: string,
    options?: SetCookieOptions
  ): Promise<void>;

  /**
   * Removes a specific cookie
   * @param key - The cookie name/key to remove
   * @param domain - The domain to remove from
   * @returns Promise resolving to true if cookie was removed, false if not found
   * @example
   * ```typescript
   * const removed = await driver.removeCookie('session', 'example.com');
   * console.log(`Cookie removed: ${removed}`);
   * ```
   */
  abstract removeCookie(key: string, domain: string): Promise<boolean>;

  /**
   * Clears all cookies matching the specified criteria
   * @param options - Options for filtering which cookies to clear
   * @returns Promise resolving to the number of cookies cleared
   * @example
   * ```typescript
   * // Clear all cookies for a domain
   * const cleared = await driver.clearCookies({ domain: 'example.com' });
   * console.log(`Cleared ${cleared} cookies`);
   *
   * // Clear all cookies
   * await driver.clearCookies();
   * ```
   */
  abstract clearCookies(options?: GetCookiesOptions): Promise<number>;

  /**
   * Gets cookies formatted as HTTP Cookie header value for a specific URL
   * @param url - The URL to get cookies for
   * @returns Promise resolving to Cookie header value (e.g., "key1=value1; key2=value2")
   * @example
   * ```typescript
   * const cookieHeader = await driver.getCookieHeader('https://example.com/api');
   * // Result: "session=abc123; csrf=def456"
   * ```
   */
  abstract getCookieHeader(url: string): Promise<string>;

  /**
   * Parses and stores cookies from Set-Cookie response headers
   * @param setCookieHeaders - Array of Set-Cookie header values
   * @param url - The URL that sent the cookies
   * @returns Promise resolving when all cookies are processed
   * @example
   * ```typescript
   * const setCookieHeaders = [
   *   'session=abc123; Path=/; Secure; HttpOnly',
   *   'csrf=def456; Path=/; SameSite=Strict'
   * ];
   * await driver.processSetCookieHeaders(setCookieHeaders, 'https://example.com');
   * ```
   */
  abstract processSetCookieHeaders(
    setCookieHeaders: string[],
    url: string
  ): Promise<void>;

  /**
   * Loads initial cookies from Insomnia configuration
   * @param cookies - Array of cookies from Insomnia config
   * @returns Promise resolving when all cookies are loaded
   * @example
   * ```typescript
   * const insomniaConfig = parseInsomniaYaml('./config.yaml');
   * if (insomniaConfig.cookieJar) {
   *   await driver.loadFromInsomniaConfig(insomniaConfig.cookieJar.cookies);
   * }
   * ```
   */
  abstract loadFromInsomniaConfig(cookies: Cookie[]): Promise<void>;

  /**
   * Gets the total number of stored cookies
   * @returns Promise resolving to the total cookie count
   */
  abstract getCookieCount(): Promise<number>;
}
