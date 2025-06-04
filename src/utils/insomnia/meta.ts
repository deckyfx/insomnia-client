// CHANGELOG: [2025-06-04] - Created InsomniaConfigMeta class

/**
 * Base metadata class for all Insomnia items
 */
export class InsomniaConfigMeta {
  public readonly id: string;
  public readonly created: number;
  public readonly modified: number;
  public readonly isPrivate?: boolean;
  public readonly sortKey?: number;

  constructor(data: {
    id: string;
    created: number;
    modified: number;
    isPrivate?: boolean;
    sortKey?: number;
  }) {
    this.id = data.id;
    this.created = data.created;
    this.modified = data.modified;
    this.isPrivate = data.isPrivate;
    this.sortKey = data.sortKey;
  }

  /**
   * Gets the creation date as a JavaScript Date object
   * @returns Date object representing when this item was created
   * @example
   * ```typescript
   * const meta = new InsomniaConfigMeta({ id: "1", created: 1640995200000, modified: 1640995200000 });
   * console.log(meta.getCreationDate()); // 2022-01-01T00:00:00.000Z
   * ```
   */
  getCreationDate(): Date {
    return new Date(this.created);
  }

  /**
   * Gets the modification date as a JavaScript Date object
   * @returns Date object representing when this item was last modified
   * @example
   * ```typescript
   * const meta = new InsomniaConfigMeta({ id: "1", created: 1640995200000, modified: 1641081600000 });
   * console.log(meta.getModificationDate()); // 2022-01-02T00:00:00.000Z
   * ```
   */
  getModificationDate(): Date {
    return new Date(this.modified);
  }
}