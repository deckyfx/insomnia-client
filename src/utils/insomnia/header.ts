// CHANGELOG: [2025-06-04] - Created InsomniaConfigHeader class

/**
 * Represents a header pair in HTTP requests
 */
export class InsomniaConfigHeader {
  public readonly id?: string;
  public readonly name?: string;
  public readonly value?: string;
  public readonly disabled?: boolean;

  constructor(data: {
    id?: string;
    name?: string;
    value?: string;
    disabled?: boolean;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.value = data.value;
    this.disabled = data.disabled;
  }

  /**
   * Checks if this header is active (not disabled)
   * @returns True if the header is active
   * @example
   * ```typescript
   * const header = new InsomniaConfigHeader({ name: "Content-Type", value: "application/json", disabled: false });
   * console.log(header.isActive()); // true
   * ```
   */
  isActive(): boolean {
    return this.disabled !== true;
  }
}