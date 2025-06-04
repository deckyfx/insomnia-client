// CHANGELOG: [2025-06-04] - Created InsomniaConfigFolder class

import { InsomniaConfigAuthentication } from "./authentication";
import { InsomniaConfigHeader } from "./header";
import { InsomniaConfigMeta } from "./meta";
import { InsomniaConfigRequest } from "./request";

/**
 * Represents a folder that can contain other folders or requests
 */
export class InsomniaConfigFolder {
  public readonly name: string;
  public readonly meta: InsomniaConfigMeta;
  public readonly children: (InsomniaConfigFolder | InsomniaConfigRequest)[];
  public readonly authentication?: InsomniaConfigAuthentication;
  public readonly headers?: InsomniaConfigHeader[];

  constructor(data: {
    name: string;
    meta: any;
    children: any[];
    authentication?: any;
    headers?: any[];
  }) {
    this.name = data.name;
    this.meta = new InsomniaConfigMeta(data.meta);
    this.children = []; // Will be populated by parser
    this.authentication = data.authentication
      ? new InsomniaConfigAuthentication(data.authentication)
      : undefined;
    this.headers = data.headers?.map(
      (header) => new InsomniaConfigHeader(header)
    );
  }

  /**
   * Gets all requests within this folder (recursive)
   * @returns Array of all requests in this folder and subfolders
   * @example
   * ```typescript
   * const folder = new InsomniaConfigFolder({
   *   name: "API Tests",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   children: []
   * });
   * console.log(folder.getAllRequests().length); // 0 initially
   * ```
   */
  getAllRequests(): InsomniaConfigRequest[] {
    const requests: InsomniaConfigRequest[] = [];

    for (const child of this.children) {
      if (child instanceof InsomniaConfigRequest) {
        requests.push(child);
      } else if (child instanceof InsomniaConfigFolder) {
        requests.push(...child.getAllRequests());
      }
    }

    return requests;
  }

  /**
   * Gets all folders within this folder (recursive)
   * @returns Array of all folders in this folder and subfolders
   * @example
   * ```typescript
   * const folder = new InsomniaConfigFolder({
   *   name: "API Tests",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   children: []
   * });
   * console.log(folder.getAllFolders().length); // 0 initially
   * ```
   */
  getAllFolders(): InsomniaConfigFolder[] {
    const folders: InsomniaConfigFolder[] = [];

    for (const child of this.children) {
      if (child instanceof InsomniaConfigFolder) {
        folders.push(child);
        folders.push(...child.getAllFolders());
      }
    }

    return folders;
  }

  /**
   * Gets the total count of items in this folder
   * @returns Total number of items (requests + folders)
   * @example
   * ```typescript
   * const folder = new InsomniaConfigFolder({
   *   name: "API Tests",
   *   meta: { id: "1", created: 123, modified: 123 },
   *   children: []
   * });
   * console.log(folder.getTotalItemCount()); // 0 initially
   * ```
   */
  getTotalItemCount(): number {
    return this.children.length;
  }
}
