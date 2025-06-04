// CHANGELOG: [2025-06-04] - Created InsomniaConfigScripts class

/**
 * Represents script configuration for requests
 */
export class InsomniaConfigScripts {
  public readonly afterResponse?: string;

  constructor(data: {
    afterResponse?: string;
  }) {
    this.afterResponse = data.afterResponse;
  }

  /**
   * Checks if there are any after-response scripts
   * @returns True if after-response scripts exist
   * @example
   * ```typescript
   * const scripts = new InsomniaConfigScripts({ afterResponse: "console.log('done');" });
   * console.log(scripts.hasAfterResponseScript()); // true
   * ```
   */
  hasAfterResponseScript(): boolean {
    return Boolean(this.afterResponse && this.afterResponse.trim().length > 0);
  }
}