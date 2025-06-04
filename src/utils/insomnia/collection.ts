// CHANGELOG: [2025-06-04] - Created InsomniaConfigCollection class

import { InsomniaConfigFolder } from "./folder";
import { InsomniaConfigRequest } from "./request";

/**
 * Represents a collection of folders and requests
 */
export class InsomniaConfigCollection {
  public readonly items: (InsomniaConfigFolder | InsomniaConfigRequest)[];

  constructor() {
    this.items = [];
  }

  /**
   * Adds an item to the collection
   * @param item - The folder or request to add
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * const request = new InsomniaConfigRequest({ ... });
   * collection.addItem(request);
   * console.log(collection.getItemCount()); // 1
   * ```
   */
  addItem(item: InsomniaConfigFolder | InsomniaConfigRequest): void {
    this.items.push(item);
  }

  /**
   * Gets all requests in the collection (recursive)
   * @returns Array of all requests in the collection
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * // ... add items ...
   * console.log(collection.getAllRequests().length);
   * ```
   */
  getAllRequests(): InsomniaConfigRequest[] {
    const requests: InsomniaConfigRequest[] = [];

    for (const item of this.items) {
      if (item instanceof InsomniaConfigRequest) {
        requests.push(item);
      } else if (item instanceof InsomniaConfigFolder) {
        requests.push(...item.getAllRequests());
      }
    }

    return requests;
  }

  /**
   * Gets all folders in the collection (recursive)
   * @returns Array of all folders in the collection
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * // ... add items ...
   * console.log(collection.getAllFolders().length);
   * ```
   */
  getAllFolders(): InsomniaConfigFolder[] {
    const folders: InsomniaConfigFolder[] = [];

    for (const item of this.items) {
      if (item instanceof InsomniaConfigFolder) {
        folders.push(item);
        folders.push(...item.getAllFolders());
      }
    }

    return folders;
  }

  /**
   * Gets the total number of items in the collection
   * @returns Total item count
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * // ... add 3 items ...
   * console.log(collection.getItemCount()); // 3
   * ```
   */
  getItemCount(): number {
    return this.items.length;
  }

  /**
   * Finds a request by its ID
   * @param id - The request ID to search for
   * @returns The request if found, undefined otherwise
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * // ... add items ...
   * const request = collection.findRequestById("req_123");
   * console.log(request?.name);
   * ```
   */
  findRequestById(id: string): InsomniaConfigRequest | undefined {
    const allRequests = this.getAllRequests();
    return allRequests.find((request) => request.meta.id === id);
  }

  /**
   * Finds a folder by its ID
   * @param id - The folder ID to search for
   * @returns The folder if found, undefined otherwise
   * @example
   * ```typescript
   * const collection = new InsomniaConfigCollection();
   * // ... add items ...
   * const folder = collection.findFolderById("fld_123");
   * console.log(folder?.name);
   * ```
   */
  findFolderById(id: string): InsomniaConfigFolder | undefined {
    const allFolders = this.getAllFolders();
    return allFolders.find((folder) => folder.meta.id === id);
  }
}
