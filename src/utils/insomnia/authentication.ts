// CHANGELOG: [2025-06-04] - Created InsomniaConfigAuthentication class
// CHANGELOG: [2025-06-04] - Added username/password support for basic authentication

/**
 * Represents authentication configuration
 */
export class InsomniaConfigAuthentication {
  public readonly type: string;
  public readonly prefix?: string;
  public readonly token?: string;
  public readonly username?: string;
  public readonly password?: string;

  constructor(data: {
    type: string;
    prefix?: string;
    token?: string;
    username?: string;
    password?: string;
  }) {
    this.type = data.type;
    this.prefix = data.prefix;
    this.token = data.token;
    this.username = data.username;
    this.password = data.password;
  }

  /**
   * Checks if this is bearer token authentication
   * @returns True if using bearer token
   * @example
   * ```typescript
   * const auth = new InsomniaConfigAuthentication({ type: "bearer", prefix: "Bearer", token: "abc123" });
   * console.log(auth.isBearerToken()); // true
   * ```
   */
  isBearerToken(): boolean {
    return this.type === 'bearer';
  }

  /**
   * Checks if this is basic authentication
   * @returns True if using basic authentication
   * @example
   * ```typescript
   * const auth = new InsomniaConfigAuthentication({ type: "basic", username: "user", password: "pass" });
   * console.log(auth.isBasicAuth()); // true
   * ```
   */
  isBasicAuth(): boolean {
    return this.type === 'basic';
  }

  /**
   * Checks if authentication is disabled
   * @returns True if authentication is disabled
   * @example
   * ```typescript
   * const auth = new InsomniaConfigAuthentication({ type: "none" });
   * console.log(auth.isDisabled()); // true
   * ```
   */
  isDisabled(): boolean {
    return this.type === 'none';
  }
}