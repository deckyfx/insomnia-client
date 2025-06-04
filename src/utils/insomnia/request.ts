// CHANGELOG: [2025-06-04] - Created InsomniaConfigRequest class

import { InsomniaConfigAuthentication } from "./authentication";
import { InsomniaConfigBody } from "./body";
import { InsomniaConfigHeader } from "./header";
import { InsomniaConfigMeta } from "./meta";
import { InsomniaConfigScripts } from "./scripts";
import { InsomniaConfigSettings } from "./settings";
import { InsomniaTemplateResolver } from "./template-resolver";

/**
 * Represents an HTTP request item
 */
export class InsomniaConfigRequest {
  public readonly url: string;
  public readonly sanitized_url: string;
  public readonly name: string;
  public readonly meta: InsomniaConfigMeta;
  public readonly method: string;
  public readonly headers?: InsomniaConfigHeader[];
  public readonly body?: InsomniaConfigBody;
  public readonly settings: InsomniaConfigSettings;
  public readonly authentication?: InsomniaConfigAuthentication;
  public readonly scripts?: InsomniaConfigScripts;

  constructor(data: {
    url: string;
    name: string;
    meta: any;
    method: string;
    headers?: any[];
    body?: any;
    settings: any;
    authentication?: any;
    scripts?: any;
  }) {
    this.url = data.url;
    this.sanitized_url = this.sanitizeUrl(data.url);
    this.name = data.name;
    this.meta = new InsomniaConfigMeta(data.meta);
    this.method = data.method.toUpperCase();
    this.headers = data.headers?.map(
      (header) => new InsomniaConfigHeader(header)
    );
    this.body = data.body ? new InsomniaConfigBody(data.body) : undefined;
    this.settings = new InsomniaConfigSettings(data.settings);
    this.authentication = data.authentication
      ? new InsomniaConfigAuthentication(data.authentication)
      : undefined;
    this.scripts = data.scripts
      ? new InsomniaConfigScripts(data.scripts)
      : undefined;
  }

  /**
   * Sanitizes a URL by adding protocol if missing
   * @param url - The original URL
   * @returns Sanitized URL with protocol
   */
  private sanitizeUrl(url: string): string {
    let sanitized = url;

    // Add http:// prefix if no protocol is specified
    if (!sanitized.startsWith("http://") && !sanitized.startsWith("https://")) {
      sanitized = "http://" + sanitized;
    }

    // Validate the sanitized URL
    try {
      new URL(sanitized);
      return sanitized;
    } catch (error) {
      // If URL is still invalid, return the original URL
      // This allows template variables to be resolved later
      return url;
    }
  }

  /**
   * Gets the resolved and sanitized URL using the provided resolver
   * @param resolver - The template resolver to use
   * @returns The resolved and sanitized URL
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({ url: "{{ _.API_URL }}/users", ... });
   * const resolvedUrl = request.getResolvedSanitizedUrl(resolver);
   * console.log(resolvedUrl); // "http://api.example.com/users"
   * ```
   */
  getResolvedSanitizedUrl(resolver: InsomniaTemplateResolver): string {
    const resolvedUrl = resolver.resolve(this.url);
    return this.sanitizeUrl(resolvedUrl);
  }

  /**
   * Gets active headers (non-disabled)
   * @returns Array of active headers
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({
   *   url: "https://api.example.com",
   *   name: "Test Request",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   method: "GET",
   *   headers: [{ name: "Accept", value: "application/json", disabled: false }],
   *   settings: { renderRequestBody: true, encodeUrl: true, followRedirects: "global", cookies: { send: true, store: true }, rebuildPath: true }
   * });
   * console.log(request.getActiveHeaders().length); // 1
   * ```
   */
  getActiveHeaders(): InsomniaConfigHeader[] {
    return this.headers?.filter((header) => header.isActive()) || [];
  }

  /**
   * Checks if this is a GET request
   * @returns True if method is GET
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({ method: "GET", ... });
   * console.log(request.isGetRequest()); // true
   * ```
   */
  isGetRequest(): boolean {
    return this.method === "GET";
  }

  /**
   * Checks if this is a POST request
   * @returns True if method is POST
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({ method: "POST", ... });
   * console.log(request.isPostRequest()); // true
   * ```
   */
  isPostRequest(): boolean {
    return this.method === "POST";
  }

  /**
   * Checks if this request has a body
   * @returns True if the request has a body
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({
   *   body: { mimeType: "application/json", text: "{}" },
   *   ...
   * });
   * console.log(request.hasBody()); // true
   * ```
   */
  hasBody(): boolean {
    return Boolean(this.body);
  }

  /**
   * Resolves template variables in the request URL using the provided resolver
   * @param resolver - The template resolver to use
   * @returns The resolved URL
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({ url: "{{ _.API_URL }}/users", ... });
   * const resolvedUrl = request.getResolvedUrl(resolver);
   * console.log(resolvedUrl); // "https://api.example.com/users"
   * ```
   */
  getResolvedUrl(resolver: InsomniaTemplateResolver): string {
    return resolver.resolve(this.url);
  }

  /**
   * Gets resolved headers with template variables replaced
   * @param resolver - The template resolver to use
   * @returns Array of resolved headers
   * @example
   * ```typescript
   * const resolvedHeaders = request.getResolvedHeaders(resolver);
   * ```
   */
  getResolvedHeaders(
    resolver: InsomniaTemplateResolver
  ): InsomniaConfigHeader[] {
    if (!this.headers) return [];

    return this.headers.map(
      (header) =>
        new InsomniaConfigHeader({
          id: header.id,
          name: header.name ? resolver.resolve(header.name) : header.name,
          value: header.value ? resolver.resolve(header.value) : header.value,
          disabled: header.disabled,
        })
    );
  }

  /**
   * Gets the resolved request body with template variables replaced
   * @param resolver - The template resolver to use
   * @returns The resolved body or undefined if no body exists
   * @example
   * ```typescript
   * const resolvedBody = request.getResolvedBody(resolver);
   * ```
   */
  getResolvedBody(
    resolver: InsomniaTemplateResolver
  ): InsomniaConfigBody | undefined {
    if (!this.body) return undefined;

    return new InsomniaConfigBody({
      mimeType: this.body.mimeType,
      text: this.body.text ? resolver.resolve(this.body.text) : this.body.text,
      params: this.body.params?.map((param) => ({
        id: param.id,
        name: resolver.resolve(param.name),
        value: resolver.resolve(param.value),
        disabled: param.disabled,
      })),
    });
  }

  /**
   * Checks if this request contains template variables
   * @returns True if the request contains any template variables
   * @example
   * ```typescript
   * const request = new InsomniaConfigRequest({ url: "{{ _.API_URL }}/users", ... });
   * console.log(request.hasTemplateVariables()); // true
   * ```
   */
  hasTemplateVariables(): boolean {
    const resolver = new InsomniaTemplateResolver();

    // Check URL
    if (resolver.hasTemplateVariables(this.url)) return true;

    // Check headers
    if (
      this.headers?.some(
        (header) =>
          (header.name && resolver.hasTemplateVariables(header.name)) ||
          (header.value && resolver.hasTemplateVariables(header.value))
      )
    )
      return true;

    // Check body
    if (this.body) {
      if (this.body.text && resolver.hasTemplateVariables(this.body.text))
        return true;
      if (
        this.body.params?.some(
          (param) =>
            resolver.hasTemplateVariables(param.name) ||
            resolver.hasTemplateVariables(param.value)
        )
      )
        return true;
    }

    return false;
  }

  /**
   * Gets all template variable names used in this request
   * @returns Array of unique variable names
   * @example
   * ```typescript
   * const variables = request.getTemplateVariables();
   * console.log(variables); // ["API_URL", "API_KEY"]
   * ```
   */
  getTemplateVariables(): string[] {
    const resolver = new InsomniaTemplateResolver();
    const variables = new Set<string>();

    // Extract from URL
    resolver.extractVariableNames(this.url).forEach((v) => variables.add(v));

    // Extract from headers
    this.headers?.forEach((header) => {
      if (header.name)
        resolver
          .extractVariableNames(header.name)
          .forEach((v) => variables.add(v));
      if (header.value)
        resolver
          .extractVariableNames(header.value)
          .forEach((v) => variables.add(v));
    });

    // Extract from body
    if (this.body) {
      if (this.body.text) {
        resolver
          .extractVariableNames(this.body.text)
          .forEach((v) => variables.add(v));
      }
      this.body.params?.forEach((param) => {
        resolver
          .extractVariableNames(param.name)
          .forEach((v) => variables.add(v));
        resolver
          .extractVariableNames(param.value)
          .forEach((v) => variables.add(v));
      });
    }

    return Array.from(variables);
  }
}
