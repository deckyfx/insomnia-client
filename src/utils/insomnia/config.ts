// CHANGELOG: [2025-06-04] - Created InsomniaConfig class

import { InsomniaConfigCollection } from "./collection";
import { InsomniaConfigCookieJar } from "./cookie";
import { InsomniaConfigEnvironment } from "./environment";
import { InsomniaConfigFolder } from "./folder";
import { InsomniaConfigMeta } from "./meta";
import { InsomniaConfigRequest } from "./request";
import { InsomniaTemplateResolver } from "./template-resolver";

/**
 * Represents the main Insomnia configuration
 */
export class InsomniaConfig {
  public readonly type: string;
  public readonly name: string;
  public readonly meta: InsomniaConfigMeta;
  public readonly collection: InsomniaConfigCollection;
  public readonly cookieJar?: InsomniaConfigCookieJar;
  public readonly environments?: InsomniaConfigEnvironment;

  constructor(data: {
    type: string;
    name: string;
    meta: any;
    collection: any[];
    cookieJar?: any;
    environments?: any;
    envOverrides?: Record<string, any>;
  }) {
    this.type = data.type;
    this.name = data.name;
    this.meta = new InsomniaConfigMeta(data.meta);
    this.collection = new InsomniaConfigCollection();
    this.cookieJar = data.cookieJar
      ? new InsomniaConfigCookieJar(data.cookieJar)
      : undefined;
    this.environments = data.environments
      ? new InsomniaConfigEnvironment({
          ...data.environments,
          overrides: data.envOverrides,
        })
      : undefined;
  }

  /**
   * Gets all requests from the configuration
   * @returns Array of all requests
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * console.log(config.getAllRequests().length);
   * ```
   */
  getAllRequests(): InsomniaConfigRequest[] {
    return this.collection.getAllRequests();
  }

  /**
   * Gets all folders from the configuration
   * @returns Array of all folders
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * console.log(config.getAllFolders().length);
   * ```
   */
  getAllFolders(): InsomniaConfigFolder[] {
    return this.collection.getAllFolders();
  }

  /**
   * Gets the total number of requests
   * @returns Total request count
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * console.log(config.getRequestCount());
   * ```
   */
  getRequestCount(): number {
    return this.getAllRequests().length;
  }

  /**
   * Gets the total number of folders
   * @returns Total folder count
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * console.log(config.getFolderCount());
   * ```
   */
  getFolderCount(): number {
    return this.getAllFolders().length;
  }

  /**
   * Checks if the configuration has environments
   * @returns True if environments are configured
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ environments: { ... }, ... });
   * console.log(config.hasEnvironments()); // true
   * ```
   */
  hasEnvironments(): boolean {
    return Boolean(this.environments);
  }

  /**
   * Checks if the configuration has a cookie jar
   * @returns True if a cookie jar is configured
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ cookieJar: { ... }, ... });
   * console.log(config.hasCookieJar()); // true
   * ```
   */
  hasCookieJar(): boolean {
    return Boolean(this.cookieJar);
  }

  /**
   * Checks if the configuration has environment overrides
   * @returns True if environment overrides are configured
   * @example
   * ```typescript
   * const config = parseInsomniaYaml('./insomnia.yaml', { HOST: 'localhost' });
   * console.log(config.hasEnvironmentOverrides()); // true
   * ```
   */
  hasEnvironmentOverrides(): boolean {
    return Boolean(
      this.environments && Object.keys(this.environments.overrides).length > 0
    );
  }

  /**
   * Gets all environment override keys
   * @returns Array of override variable keys
   * @example
   * ```typescript
   * const config = parseInsomniaYaml('./insomnia.yaml', { HOST: 'localhost', PORT: '3000' });
   * console.log(config.getEnvironmentOverrideKeys()); // ["HOST", "PORT"]
   * ```
   */
  getEnvironmentOverrideKeys(): string[] {
    return this.environments ? Object.keys(this.environments.overrides) : [];
  }

  /**
   * Gets variables that are being overridden (exist in both Insomnia and overrides)
   * @returns Array of overridden variable keys
   * @example
   * ```typescript
   * const config = parseInsomniaYaml('./insomnia.yaml', { HOST: 'localhost' });
   * console.log(config.getOverriddenVariables()); // ["HOST"] if HOST exists in Insomnia
   * ```
   */
  getOverriddenVariables(): string[] {
    return this.environments ? this.environments.getOverriddenVariables() : [];
  }

  /**
   * Gets variables that are only in overrides (new variables)
   * @returns Array of new variable keys
   * @example
   * ```typescript
   * const config = parseInsomniaYaml('./insomnia.yaml', { DEBUG: 'true', NODE_ENV: 'development' });
   * console.log(config.getNewEnvironmentVariables()); // ["DEBUG", "NODE_ENV"] if not in Insomnia
   * ```
   */
  getNewEnvironmentVariables(): string[] {
    return this.environments ? this.environments.getNewVariables() : [];
  }

  /**
   * Creates a template resolver using the configuration's environment
   * @param options - Options for template resolution
   * @returns A template resolver instance
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const resolver = config.createTemplateResolver();
   * const resolvedUrl = resolver.resolve("{{ _.API_URL }}/users");
   *
   * // Or use the config.resolve() method directly:
   * const resolvedUrl2 = config.resolve("environments.data.API_URL") + "/users";
   * ```
   */
  createTemplateResolver(options?: {
    strict?: boolean;
    undefinedReplacement?: string;
  }): InsomniaTemplateResolver {
    return new InsomniaTemplateResolver(this.environments, options);
  }

  /**
   * Gets all template variables used across all requests in the configuration
   * @returns Array of unique variable names
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const variables = config.getAllTemplateVariables();
   * console.log(variables); // ["API_URL", "API_KEY", "HOST"]
   * ```
   */
  getAllTemplateVariables(): string[] {
    const variables = new Set<string>();

    this.getAllRequests().forEach((request) => {
      request.getTemplateVariables().forEach((v) => variables.add(v));
    });

    return Array.from(variables);
  }

  /**
   * Gets all undefined template variables (variables used but not defined in environment)
   * @returns Array of undefined variable names
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const undefinedVars = config.getUndefinedTemplateVariables();
   * console.log(undefinedVars); // ["MISSING_VAR"]
   *
   * // You can also check specific paths:
   * const rawUrl = config.resolve("collection.items.[0].children.[0].children.[0].url", true);
   * console.log(rawUrl); // "{{ _.API_URL }}/api/user"
   * ```
   */
  getUndefinedTemplateVariables(): string[] {
    const allVariables = this.getAllTemplateVariables();
    return allVariables.filter(
      (varName) => !this.environments?.hasVariable(varName)
    );
  }

  /**
   * Validates that all template variables can be resolved
   * @returns Validation result with details
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const validation = config.validateTemplateVariables();
   * console.log(validation.isValid); // true/false
   * console.log(validation.undefinedVariables); // ["MISSING_VAR"]
   * ```
   */
  validateTemplateVariables(): {
    isValid: boolean;
    allVariables: string[];
    undefinedVariables: string[];
    definedVariables: string[];
  } {
    const allVariables = this.getAllTemplateVariables();
    const undefinedVariables = this.getUndefinedTemplateVariables();
    const definedVariables = allVariables.filter((varName) =>
      this.environments?.hasVariable(varName)
    );

    return {
      isValid: undefinedVariables.length === 0,
      allVariables,
      undefinedVariables,
      definedVariables,
    };
  }

  /**
   * Gets requests that contain template variables
   * @returns Array of requests with template variables
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const templatedRequests = config.getRequestsWithTemplateVariables();
   * console.log(templatedRequests.length);
   * ```
   */
  getRequestsWithTemplateVariables(): InsomniaConfigRequest[] {
    return this.getAllRequests().filter((request) =>
      request.hasTemplateVariables()
    );
  }

  /**
   * Resolves all template variables in a request and returns a resolved copy
   * @param request - The request to resolve
   * @param options - Template resolution options
   * @returns Object with resolved request data
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const request = config.getAllRequests()[0];
   * const resolved = config.resolveRequest(request);
   * console.log(resolved.url); // "https://api.example.com/users"
   * ```
   */
  resolveRequest(
    request: InsomniaConfigRequest,
    options?: { strict?: boolean; undefinedReplacement?: string }
  ): {
    url: string;
    headers: Array<{ name?: string; value?: string; disabled?: boolean }>;
    body?: {
      mimeType: string;
      text?: string;
      params?: Array<{ name: string; value: string; disabled: boolean }>;
    };
  } {
    const resolver = this.createTemplateResolver(options);

    return {
      url: request.getResolvedUrl(resolver),
      headers: request.getResolvedHeaders(resolver).map((h) => ({
        name: h.name,
        value: h.value,
        disabled: h.disabled,
      })),
      body: request.getResolvedBody(resolver)
        ? {
            mimeType: request.getResolvedBody(resolver)!.mimeType,
            text: request.getResolvedBody(resolver)!.text,
            params: request.getResolvedBody(resolver)!.params?.map((p) => ({
              name: p.name,
              value: p.value,
              disabled: p.disabled,
            })),
          }
        : undefined,
    };
  }

  /**
   * Resolves a value from the configuration using dot notation path
   * @param path - The dot notation path to the value (e.g., "type", "environments.data.HOST", "collection.items.[0].name")
   * @param raw - If true, returns raw value; if false (default), resolves template variables in strings
   * @param options - Template resolution options (only used when raw=false)
   * @returns The resolved value or undefined if path doesn't exist
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   *
   * // Basic path resolution (template variables resolved by default)
   * console.log(config.resolve("type")); // "collection.insomnia.rest/5.0"
   * console.log(config.resolve("name")); // "Local Jungle"
   * console.log(config.resolve("environments.data.HOST")); // "192.168.0.103"
   *
   * // Template variable resolution (default behavior)
   * console.log(config.resolve("environments.data.API_URL")); // "http://192.168.0.103:5003"
   * console.log(config.resolve("environments.data.API_HOST")); // "192.168.0.103:5003"
   *
   * // Raw values (template variables NOT resolved)
   * console.log(config.resolve("environments.data.API_URL", true)); // "http://{{ _.API_HOST }}"
   * console.log(config.resolve("environments.data.API_HOST", true)); // "{{ _.HOST }}:{{ _.API_PORT }}"
   *
   * // Array access
   * console.log(config.resolve("collection.items.[0].name")); // "API"
   * console.log(config.resolve("cookieJar.cookies.[0].domain")); // "192.168.0.103"
   *
   * // Deep path access
   * console.log(config.resolve("collection.items.[0].children.[0].children.[0].name")); // "Get User"
   * console.log(config.resolve("collection.items.[0].children.[0].children.[0].url")); // "http://192.168.0.103:5003/api/user"
   * console.log(config.resolve("collection.items.[0].children.[0].children.[0].url", true)); // "{{ _.API_URL }}/api/user"
   *
   * // Custom template resolution options
   * console.log(config.resolve("environments.data.API_URL", false, { strict: true })); // Throws if variables undefined
   * console.log(config.resolve("{{ _.MISSING }}", false, { undefinedReplacement: "[NOT_FOUND]" })); // "[NOT_FOUND]"
   * ```
   */
  resolve(
    path: string,
    raw: boolean = false,
    options?: { strict?: boolean; undefinedReplacement?: string }
  ): any {
    if (!path || typeof path !== "string") {
      return undefined;
    }

    // Split the path by dots, but handle array notation like [0]
    const pathParts = this.parsePath(path);
    let current: any = this;

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index notation [0], [1], etc.
      if (part.startsWith("[") && part.endsWith("]")) {
        const index = parseInt(part.slice(1, -1), 10);
        if (isNaN(index) || !Array.isArray(current)) {
          return undefined;
        }
        current = current[index];
      } else {
        // Handle object property access
        if (typeof current === "object" && part in current) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }

    // Special handling for environment data paths to apply overrides
    if (!raw && path.startsWith("environments.data.")) {
      const envVarKey = path.replace("environments.data.", "");
      if (this.environments) {
        const envValue = this.environments.getVariable(envVarKey);
        if (typeof envValue === "string") {
          const resolver = this.createTemplateResolver(options);
          return resolver.resolve(envValue);
        }
        return envValue;
      }
    }

    // If raw=true, return the value as-is
    if (raw) {
      return current;
    }

    // If raw=false (default), resolve template variables in strings
    if (typeof current === "string") {
      const resolver = this.createTemplateResolver(options);
      return resolver.resolve(current);
    }

    return current;
  }

  /**
   * Checks if a path exists in the configuration
   * @param path - The dot notation path to check
   * @returns True if the path exists and has a defined value
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * console.log(config.hasPath("type")); // true
   * console.log(config.hasPath("environments.data.HOST")); // true
   * console.log(config.hasPath("nonexistent.path")); // false
   * ```
   */
  hasPath(path: string): boolean {
    return this.resolve(path, true) !== undefined;
  }

  /**
   * Gets all available paths in the configuration (useful for debugging)
   * @param maxDepth - Maximum depth to traverse (default: 3)
   * @returns Array of available paths
   * @example
   * ```typescript
   * const config = new InsomniaConfig({ ... });
   * const paths = config.getAvailablePaths(2);
   * console.log(paths); // ["type", "name", "meta.id", "environments.name", ...]
   * ```
   */
  getAvailablePaths(maxDepth: number = 3): string[] {
    const paths: string[] = [];

    const traverse = (obj: any, currentPath: string, depth: number) => {
      if (depth > maxDepth || obj === null || obj === undefined) {
        return;
      }

      if (Array.isArray(obj)) {
        // For arrays, show a few indices as examples
        const indicesToShow = Math.min(obj.length, 3);
        for (let i = 0; i < indicesToShow; i++) {
          const arrayPath = currentPath ? `${currentPath}.[${i}]` : `[${i}]`;
          paths.push(arrayPath);

          if (typeof obj[i] === "object" && obj[i] !== null) {
            traverse(obj[i], arrayPath, depth + 1);
          }
        }

        if (obj.length > indicesToShow) {
          paths.push(currentPath ? `${currentPath}.[...]` : "[...]");
        }
      } else if (typeof obj === "object") {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const newPath = currentPath ? `${currentPath}.${key}` : key;
            paths.push(newPath);

            if (typeof obj[key] === "object" && obj[key] !== null) {
              traverse(obj[key], newPath, depth + 1);
            }
          }
        }
      }
    };

    traverse(this, "", 0);
    return paths.sort();
  }

  /**
   * Parses a dot notation path into an array of path segments
   * @private
   * @param path - The path to parse
   * @returns Array of path segments
   */
  private parsePath(path: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === "[") {
        if (current) {
          parts.push(current);
          current = "";
        }
        inBrackets = true;
        current = "[";
      } else if (char === "]" && inBrackets) {
        current += "]";
        parts.push(current);
        current = "";
        inBrackets = false;
      } else if (char === "." && !inBrackets) {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }
}
