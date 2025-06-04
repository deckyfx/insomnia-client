// CHANGELOG: [2025-06-04] - Created template variable resolution utility for Insomnia directives
// CHANGELOG: [2025-06-04] - Fixed regex pattern to support mixed case variable names (e.g., UserAgent)

import { InsomniaConfigEnvironment } from "./environment";

// CHANGELOG: [2025-06-04] - Refactored to import types from @types directory

import type { TemplateResolverOptions } from "../../@types/utils/index";

/**
 * Utility class for resolving Insomnia template variables
 */
export class InsomniaTemplateResolver {
  private environment?: InsomniaConfigEnvironment;
  private options: Required<TemplateResolverOptions>;

  constructor(
    environment?: InsomniaConfigEnvironment,
    options: TemplateResolverOptions = {}
  ) {
    this.environment = environment;
    this.options = {
      strict: options.strict ?? false,
      undefinedReplacement: options.undefinedReplacement ?? "",
    };
  }

  /**
   * Resolves template variables in a string
   * @param template - The template string containing variables like {{ _.VARIABLE }}
   * @returns The resolved string with variables replaced
   * @throws {Error} When strict mode is enabled and variable is not found
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver(environment);
   * const resolved = resolver.resolve("{{ _.API_URL }}/users");
   * // Returns: "https://api.example.com/users"
   * ```
   */
  resolve(template: string): string {
    if (!template || typeof template !== "string") {
      return template;
    }

    // Match Insomnia template variables: {{ _.VARIABLE_NAME }} (supports mixed case)
    const templateRegex = /\{\{\s*_\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

    return template.replace(templateRegex, (match, variableName) => {
      // Try to get the variable from environment
      const value = this.environment?.getVariable(variableName);

      if (value !== undefined) {
        // Recursively resolve nested templates
        return this.resolve(value);
      }

      // Handle undefined variables based on options
      if (this.options.strict) {
        throw new Error(`Template variable not found: ${variableName}`);
      }

      return this.options.undefinedReplacement || match;
    });
  }

  /**
   * Resolves template variables in an object recursively
   * @param obj - The object containing template strings
   * @returns New object with resolved template variables
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver(environment);
   * const resolved = resolver.resolveObject({
   *   url: "{{ _.API_URL }}/users",
   *   headers: { host: "{{ _.API_HOST }}" }
   * });
   * ```
   */
  resolveObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      return this.resolve(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item)) as unknown as T;
    }

    if (typeof obj === "object") {
      const resolved = {} as T;
      for (const [key, value] of Object.entries(obj)) {
        (resolved as any)[key] = this.resolveObject(value);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Checks if a string contains template variables
   * @param str - The string to check
   * @returns True if the string contains template variables
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver();
   * console.log(resolver.hasTemplateVariables("{{ _.API_URL }}")); // true
   * console.log(resolver.hasTemplateVariables("https://api.com")); // false
   * ```
   */
  hasTemplateVariables(str: string): boolean {
    if (!str || typeof str !== "string") {
      return false;
    }
    return /\{\{\s*_\.[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/.test(str);
  }

  /**
   * Extracts all template variable names from a string
   * @param str - The string to analyze
   * @returns Array of variable names found in the string
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver();
   * const vars = resolver.extractVariableNames("{{ _.API_URL }}/{{ _.VERSION }}");
   * console.log(vars); // ["API_URL", "VERSION"]
   * ```
   */
  extractVariableNames(str: string): string[] {
    if (!str || typeof str !== "string") {
      return [];
    }

    const templateRegex = /\{\{\s*_\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = templateRegex.exec(str)) !== null) {
      if (match[1]) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Gets all undefined variables in a template string
   * @param template - The template string to check
   * @returns Array of undefined variable names
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver(environment);
   * const undefined = resolver.getUndefinedVariables("{{ _.MISSING }}/{{ _.API_URL }}");
   * console.log(undefined); // ["MISSING"] (if MISSING is not in environment)
   * ```
   */
  getUndefinedVariables(template: string): string[] {
    const allVariables = this.extractVariableNames(template);
    return allVariables.filter(
      (varName) => !this.environment?.hasVariable(varName)
    );
  }

  /**
   * Validates that all template variables in a string can be resolved
   * @param template - The template string to validate
   * @returns Object with validation result and details
   * @example
   * ```typescript
   * const resolver = new InsomniaTemplateResolver(environment);
   * const result = resolver.validateTemplate("{{ _.API_URL }}/users");
   * console.log(result.isValid); // true/false
   * console.log(result.undefinedVariables); // array of missing variables
   * ```
   */
  validateTemplate(template: string): {
    isValid: boolean;
    undefinedVariables: string[];
    allVariables: string[];
  } {
    const allVariables = this.extractVariableNames(template);
    const undefinedVariables = this.getUndefinedVariables(template);

    return {
      isValid: undefinedVariables.length === 0,
      undefinedVariables,
      allVariables,
    };
  }

  /**
   * Creates a new resolver with different options
   * @param options - New options to apply
   * @returns New resolver instance with updated options
   * @example
   * ```typescript
   * const strictResolver = resolver.withOptions({ strict: true });
   * ```
   */
  withOptions(options: TemplateResolverOptions): InsomniaTemplateResolver {
    return new InsomniaTemplateResolver(this.environment, {
      ...this.options,
      ...options,
    });
  }

  /**
   * Sets a new environment for template resolution
   * @param environment - The new environment configuration
   * @returns New resolver instance with updated environment
   * @example
   * ```typescript
   * const newResolver = resolver.withEnvironment(newEnvironment);
   * ```
   */
  withEnvironment(
    environment: InsomniaConfigEnvironment
  ): InsomniaTemplateResolver {
    return new InsomniaTemplateResolver(environment, this.options);
  }
}
