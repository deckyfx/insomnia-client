// CHANGELOG: [2025-06-04] - Created InsomniaConfigSettings class

/**
 * Represents request settings configuration
 */
export class InsomniaConfigSettings {
  public readonly renderRequestBody: boolean;
  public readonly encodeUrl: boolean;
  public readonly followRedirects: string;
  public readonly cookies: {
    send: boolean;
    store: boolean;
  };
  public readonly rebuildPath: boolean;

  constructor(data: {
    renderRequestBody: boolean;
    encodeUrl: boolean;
    followRedirects: string;
    cookies: {
      send: boolean;
      store: boolean;
    };
    rebuildPath: boolean;
  }) {
    this.renderRequestBody = data.renderRequestBody;
    this.encodeUrl = data.encodeUrl;
    this.followRedirects = data.followRedirects;
    this.cookies = data.cookies;
    this.rebuildPath = data.rebuildPath;
  }

  /**
   * Checks if cookies are enabled for this request
   * @returns True if cookies are enabled
   * @example
   * ```typescript
   * const settings = new InsomniaConfigSettings({
   *   renderRequestBody: true,
   *   encodeUrl: true,
   *   followRedirects: "global",
   *   cookies: { send: true, store: true },
   *   rebuildPath: true
   * });
   * console.log(settings.isCookiesEnabled()); // true
   * ```
   */
  isCookiesEnabled(): boolean {
    return this.cookies.send && this.cookies.store;
  }
}