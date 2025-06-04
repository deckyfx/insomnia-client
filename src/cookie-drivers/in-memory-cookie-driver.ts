// CHANGELOG: [2025-06-04] - Created InMemoryCookieDriver for runtime cookie management

import type {
  Cookie,
  GetCookiesOptions,
  SetCookieOptions,
} from "../@types/cookie/index";
import { CookieDriver } from "./base-cookie-driver";

/**
 * In-memory implementation of CookieDriver
 * Stores cookies in memory during application runtime
 * Cookies are lost when the application terminates
 */
export class InMemoryCookieDriver extends CookieDriver {
  private cookies: Map<string, Cookie> = new Map();

  /**
   * Creates a unique key for storing cookies
   * @param key - Cookie name
   * @param domain - Cookie domain
   * @returns Unique storage key
   */
  private getCookieKey(key: string, domain: string): string {
    return `${domain}:${key}`;
  }

  /**
   * Generates a unique ID for a new cookie
   * @returns Unique cookie ID
   */
  private generateCookieId(): string {
    return `cookie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Checks if a cookie matches the filter criteria
   * @param cookie - Cookie to check
   * @param options - Filter options
   * @returns True if cookie matches filters
   */
  private matchesFilter(cookie: Cookie, options?: GetCookiesOptions): boolean {
    if (options?.domain && cookie.domain !== options.domain) return false;
    if (options?.path && cookie.path !== options.path) return false;
    if (options?.secure !== undefined && cookie.secure !== options.secure)
      return false;
    if (options?.httpOnly !== undefined && cookie.httpOnly !== options.httpOnly)
      return false;
    return true;
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
   * Removes expired cookies from storage
   */
  private cleanupExpiredCookies(): void {
    for (const [key, cookie] of this.cookies.entries()) {
      if (this.isExpired(cookie)) {
        this.cookies.delete(key);
      }
    }
  }

  async getCookies(options?: GetCookiesOptions): Promise<Cookie[]> {
    this.cleanupExpiredCookies();

    const result: Cookie[] = [];
    for (const cookie of this.cookies.values()) {
      if (this.matchesFilter(cookie, options)) {
        result.push(cookie);
      }
    }

    return result;
  }

  async getCookie(key: string, domain: string): Promise<Cookie | undefined> {
    this.cleanupExpiredCookies();

    const cookieKey = this.getCookieKey(key, domain);
    const cookie = this.cookies.get(cookieKey);

    if (cookie && this.isExpired(cookie)) {
      this.cookies.delete(cookieKey);
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
    const cookieKey = this.getCookieKey(key, domain);

    // Check if cookie already exists to preserve ID
    const existingCookie = this.cookies.get(cookieKey);
    const id = existingCookie?.id || this.generateCookieId();

    const cookie: Cookie = {
      id,
      key,
      value,
      domain,
      path: options?.path || "/",
      secure: options?.secure || false,
      httpOnly: options?.httpOnly || false,
      creation: existingCookie?.creation || now,
      hostOnly: options?.hostOnly || false,
      lastAccessed: now,
      expires: options?.expires,
      maxAge: options?.maxAge,
      sameSite: options?.sameSite,
    };

    this.cookies.set(cookieKey, cookie);
  }

  async removeCookie(key: string, domain: string): Promise<boolean> {
    const cookieKey = this.getCookieKey(key, domain);
    return this.cookies.delete(cookieKey);
  }

  async clearCookies(options?: GetCookiesOptions): Promise<number> {
    let cleared = 0;

    if (!options) {
      // Clear all cookies
      cleared = this.cookies.size;
      this.cookies.clear();
    } else {
      // Clear cookies matching filter
      const toDelete: string[] = [];
      for (const [key, cookie] of this.cookies.entries()) {
        if (this.matchesFilter(cookie, options)) {
          toDelete.push(key);
        }
      }

      for (const key of toDelete) {
        this.cookies.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  async getCookieHeader(url: string): Promise<string> {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    const isSecure = urlObj.protocol === "https:";

    this.cleanupExpiredCookies();

    const applicableCookies: Cookie[] = [];

    for (const cookie of this.cookies.values()) {
      // Check domain match
      if (cookie.hostOnly) {
        if (cookie.domain !== domain) continue;
      } else {
        if (!domain.endsWith(cookie.domain) && domain !== cookie.domain)
          continue;
      }

      // Check path match
      if (!path.startsWith(cookie.path)) continue;

      // Check secure requirement
      if (cookie.secure && !isSecure) continue;

      applicableCookies.push(cookie);
    }

    // Sort by path specificity (longer paths first)
    applicableCookies.sort((a, b) => b.path.length - a.path.length);

    // Update last accessed time and build header
    const now = new Date().toISOString();
    const cookiePairs: string[] = [];

    for (const cookie of applicableCookies) {
      // Update last accessed time
      const updatedCookie = { ...cookie, lastAccessed: now };
      const cookieKey = this.getCookieKey(cookie.key, cookie.domain);
      this.cookies.set(cookieKey, updatedCookie);

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
    for (const cookie of cookies) {
      const cookieKey = this.getCookieKey(cookie.key, cookie.domain);
      this.cookies.set(cookieKey, { ...cookie });
    }
  }

  async getCookieCount(): Promise<number> {
    this.cleanupExpiredCookies();
    return this.cookies.size;
  }
}
