// CHANGELOG: [2025-06-04] - Created InsomniaConfigEnvironment class

import { InsomniaConfigMeta } from "./meta";

/**
 * Represents environment data configuration
 */
export class InsomniaConfigEnvironment {
  public readonly name: string;
  public readonly meta: InsomniaConfigMeta;
  public readonly data: Record<string, string>;
  public readonly overrides: Record<string, any>;

  constructor(data: {
    name: string;
    meta: any;
    data: Record<string, string>;
    overrides?: Record<string, any>;
  }) {
    this.name = data.name;
    this.meta = new InsomniaConfigMeta(data.meta);
    this.data = data.data;
    this.overrides = data.overrides || {};
  }

  /**
   * Gets a specific environment variable with override priority
   * Priority: overrides > Insomnia environment data > undefined
   * @param key - The variable key
   * @returns The variable value or undefined if not found
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   name: "Dev Environment",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   data: { API_URL: "https://dev.api.com", PORT: "3000" },
   *   overrides: { API_URL: "https://localhost:8080" }
   * });
   * console.log(env.getVariable("API_URL")); // "https://localhost:8080" (override wins)
   * console.log(env.getVariable("PORT")); // "3000" (from Insomnia data)
   * ```
   */
  getVariable(key: string): string | undefined {
    // Check overrides first (highest priority)
    if (key in this.overrides) {
      const value = this.overrides[key];
      // Convert to string if needed
      return value !== null && value !== undefined ? String(value) : undefined;
    }

    // Fall back to Insomnia environment data
    return this.data[key];
  }

  /**
   * Gets all environment variable keys (including overrides)
   * @returns Array of all variable keys
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "...", PORT: "..." },
   *   overrides: { HOST: "localhost" },
   *   ...
   * });
   * console.log(env.getVariableKeys()); // ["API_URL", "PORT", "HOST"]
   * ```
   */
  getVariableKeys(): string[] {
    const allKeys = new Set([
      ...Object.keys(this.data),
      ...Object.keys(this.overrides),
    ]);
    return Array.from(allKeys);
  }

  /**
   * Gets the total number of environment variables (including overrides)
   * @returns Total variable count
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "...", PORT: "..." },
   *   overrides: { HOST: "localhost" },
   *   ...
   * });
   * console.log(env.getVariableCount()); // 3
   * ```
   */
  getVariableCount(): number {
    return this.getVariableKeys().length;
  }

  /**
   * Checks if a variable exists (in either data or overrides)
   * @param key - The variable key to check
   * @returns True if the variable exists
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "..." },
   *   overrides: { HOST: "localhost" },
   *   ...
   * });
   * console.log(env.hasVariable("API_URL")); // true (from data)
   * console.log(env.hasVariable("HOST")); // true (from overrides)
   * console.log(env.hasVariable("MISSING")); // false
   * ```
   */
  hasVariable(key: string): boolean {
    return key in this.data || key in this.overrides;
  }

  /**
   * Gets variables that are being overridden
   * @returns Array of variable keys that have override values
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "https://api.com", PORT: "3000" },
   *   overrides: { API_URL: "https://localhost:8080" },
   *   ...
   * });
   * console.log(env.getOverriddenVariables()); // ["API_URL"]
   * ```
   */
  getOverriddenVariables(): string[] {
    return Object.keys(this.overrides).filter((key) => key in this.data);
  }

  /**
   * Gets variables that are only in overrides (not in original data)
   * @returns Array of variable keys that are only in overrides
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "https://api.com" },
   *   overrides: { HOST: "localhost", DEBUG: "true" },
   *   ...
   * });
   * console.log(env.getNewVariables()); // ["HOST", "DEBUG"]
   * ```
   */
  getNewVariables(): string[] {
    return Object.keys(this.overrides).filter((key) => !(key in this.data));
  }

  /**
   * Gets the original value of a variable (before override)
   * @param key - The variable key
   * @returns The original value from Insomnia data or undefined
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "https://api.com" },
   *   overrides: { API_URL: "https://localhost:8080" },
   *   ...
   * });
   * console.log(env.getOriginalValue("API_URL")); // "https://api.com"
   * console.log(env.getVariable("API_URL")); // "https://localhost:8080"
   * ```
   */
  getOriginalValue(key: string): string | undefined {
    return this.data[key];
  }

  /**
   * Gets the override value of a variable
   * @param key - The variable key
   * @returns The override value or undefined if not overridden
   * @example
   * ```typescript
   * const env = new InsomniaConfigEnvironment({
   *   data: { API_URL: "https://api.com" },
   *   overrides: { API_URL: "https://localhost:8080" },
   *   ...
   * });
   * console.log(env.getOverrideValue("API_URL")); // "https://localhost:8080"
   * ```
   */
  getOverrideValue(key: string): any {
    return this.overrides[key];
  }
}
