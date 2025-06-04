// CHANGELOG: [2025-06-04] - Created InsomniaConfigCookie and InsomniaConfigCookieJar classes

import { InsomniaConfigMeta } from "./meta";

/**
 * Represents a cookie in the cookie jar
 */
export class InsomniaConfigCookie {
  public readonly id: string;
  public readonly key: string;
  public readonly value: string;
  public readonly domain: string;
  public readonly path: string;
  public readonly secure: boolean;
  public readonly httpOnly: boolean;
  public readonly creation: string;
  public readonly hostOnly: boolean;
  public readonly lastAccessed: string;

  constructor(data: {
    id: string;
    key: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    creation: string;
    hostOnly: boolean;
    lastAccessed: string;
  }) {
    this.id = data.id;
    this.key = data.key;
    this.value = data.value;
    this.domain = data.domain;
    this.path = data.path;
    this.secure = data.secure;
    this.httpOnly = data.httpOnly;
    this.creation = data.creation;
    this.hostOnly = data.hostOnly;
    this.lastAccessed = data.lastAccessed;
  }

  /**
   * Gets the creation date as a JavaScript Date object
   * @returns Date object representing when this cookie was created
   * @example
   * ```typescript
   * const cookie = new InsomniaConfigCookie({
   *   id: "1", key: "session", value: "abc123", domain: "example.com", path: "/",
   *   secure: true, httpOnly: true, creation: "2022-01-01T00:00:00.000Z",
   *   hostOnly: true, lastAccessed: "2022-01-01T00:00:00.000Z"
   * });
   * console.log(cookie.getCreationDate()); // 2022-01-01T00:00:00.000Z
   * ```
   */
  getCreationDate(): Date {
    return new Date(this.creation);
  }

  /**
   * Gets the last accessed date as a JavaScript Date object
   * @returns Date object representing when this cookie was last accessed
   * @example
   * ```typescript
   * const cookie = new InsomniaConfigCookie({ ..., lastAccessed: "2022-01-02T00:00:00.000Z" });
   * console.log(cookie.getLastAccessedDate()); // 2022-01-02T00:00:00.000Z
   * ```
   */
  getLastAccessedDate(): Date {
    return new Date(this.lastAccessed);
  }

  /**
   * Checks if this cookie is secure
   * @returns True if the cookie requires HTTPS
   * @example
   * ```typescript
   * const cookie = new InsomniaConfigCookie({ ..., secure: true });
   * console.log(cookie.isSecure()); // true
   * ```
   */
  isSecure(): boolean {
    return this.secure;
  }
}

/**
 * Represents the cookie jar configuration
 */
export class InsomniaConfigCookieJar {
  public readonly name: string;
  public readonly meta: InsomniaConfigMeta;
  public readonly cookies: InsomniaConfigCookie[];

  constructor(data: { name: string; meta: any; cookies: any[] }) {
    this.name = data.name;
    this.meta = new InsomniaConfigMeta(data.meta);
    this.cookies = data.cookies.map(
      (cookie) => new InsomniaConfigCookie(cookie)
    );
  }

  /**
   * Gets cookies for a specific domain
   * @param domain - The domain to filter by
   * @returns Array of cookies for the specified domain
   * @example
   * ```typescript
   * const jar = new InsomniaConfigCookieJar({
   *   name: "Default Jar",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   cookies: [{ domain: "example.com", ... }]
   * });
   * console.log(jar.getCookiesForDomain("example.com").length); // 1
   * ```
   */
  getCookiesForDomain(domain: string): InsomniaConfigCookie[] {
    return this.cookies.filter((cookie) => cookie.domain === domain);
  }

  /**
   * Gets the total number of cookies
   * @returns Total cookie count
   * @example
   * ```typescript
   * const jar = new InsomniaConfigCookieJar({ cookies: [{...}, {...}], ... });
   * console.log(jar.getCookieCount()); // 2
   * ```
   */
  getCookieCount(): number {
    return this.cookies.length;
  }
}
