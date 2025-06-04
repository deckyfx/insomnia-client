// CHANGELOG: [2025-06-04] - Created Insomnia YAML parser with comprehensive TypeScript interfaces and parsing logic
// CHANGELOG: [2025-06-04] - Refactored to use organized sub-classes for better code structure
// CHANGELOG: [2025-06-04] - Split classes into separate files for better organization
// CHANGELOG: [2025-06-04] - Added inheritance support for headers and authentication from parent folders to child requests

import { existsSync, readFileSync } from "fs";
import { parse } from "yaml";
import {
  InsomniaConfig,
  InsomniaConfigFolder,
  InsomniaConfigRequest,
  InsomniaParseError,
  InsomniaConfigAuthentication,
  InsomniaConfigHeader,
} from "./insomnia/index";

/**
 * Context for tracking inherited properties from parent folders
 */
interface InheritanceContext {
  headers: InsomniaConfigHeader[];
  authentication?: InsomniaConfigAuthentication;
}

/**
 * Validates if an object is a valid Insomnia request
 * @param item - The object to validate
 * @returns True if the object is a valid request
 */
function isInsomniaRequest(item: any): boolean {
  return (
    item &&
    typeof item.url === "string" &&
    typeof item.name === "string" &&
    typeof item.method === "string" &&
    item.meta &&
    typeof item.meta.id === "string"
  );
}

/**
 * Validates if an object is a valid Insomnia folder
 * @param item - The object to validate
 * @returns True if the object is a valid folder
 */
function isInsomniaFolder(item: any): boolean {
  return (
    item &&
    typeof item.name === "string" &&
    Array.isArray(item.children) &&
    item.meta &&
    typeof item.meta.id === "string"
  );
}

/**
 * Parses and validates collection items (folders and requests) with inheritance support
 * @param items - Array of collection items from YAML
 * @param inheritanceContext - Context containing inherited headers and authentication from parent folders
 * @returns Array of validated Insomnia folders and requests
 * @throws {InsomniaParseError} When validation fails
 */
function parseCollectionItems(
  items: any[],
  inheritanceContext: InheritanceContext = { headers: [] }
): (InsomniaConfigFolder | InsomniaConfigRequest)[] {
  const result: (InsomniaConfigFolder | InsomniaConfigRequest)[] = [];

  for (const item of items) {
    if (isInsomniaRequest(item)) {
      // Pass inheritance context to request constructor 
      result.push(new InsomniaConfigRequest(item));
    } else if (isInsomniaFolder(item)) {
      // Create folder and build inheritance context for its children
      const folder = new InsomniaConfigFolder(item);
      
      // Build inheritance context for children by merging parent context with folder's properties
      const childInheritanceContext: InheritanceContext = {
        headers: [
          ...inheritanceContext.headers,
          ...(folder.headers || [])
        ],
        authentication: folder.authentication || inheritanceContext.authentication
      };
      
      // Recursively parse children with inheritance context
      const children = parseCollectionItems(item.children, childInheritanceContext);
      // Manually add children to the folder since constructor sets empty array
      children.forEach((child) => (folder as any).children.push(child));
      result.push(folder);
    } else {
      throw new InsomniaParseError(
        `Invalid collection item: missing required fields in item with name "${
          item?.name || "unknown"
        }"`
      );
    }
  }

  return result;
}

/**
 * Parses an Insomnia YAML configuration file and returns a typed configuration object
 * @param filePath - Absolute path to the Insomnia YAML file
 * @param envOverrides - Optional environment variable overrides that take priority over Insomnia's environment
 * @returns Parsed and validated Insomnia configuration
 * @throws {InsomniaParseError} When file doesn't exist, parsing fails, or validation fails
 * @example
 * ```typescript
 * // Basic usage
 * const config = parseInsomniaYaml('/path/to/insomnia.yaml');
 * console.log(`Collection name: ${config.name}`);
 *
 * // With environment overrides (e.g., from .env file)
 * import { readEnvFile } from './env';
 * const envOverrides = readEnvFile();
 * const config = parseInsomniaYaml('/path/to/insomnia.yaml', envOverrides);
 *
 * // Manual overrides
 * const config = parseInsomniaYaml('/path/to/insomnia.yaml', {
 *   HOST: 'localhost',
 *   API_PORT: '3000',
 *   DEBUG_MODE: 'true'
 * });
 *
 * // Environment resolution priority: envOverrides > Insomnia environments > undefined
 * console.log(config.resolve("environments.data.HOST")); // Uses override value if provided
 * ```
 */
export function parseInsomniaYaml(
  filePath: string,
  envOverrides?: Record<string, any>
): InsomniaConfig {
  // Validate that file path is provided
  if (!filePath || typeof filePath !== "string") {
    throw new InsomniaParseError(
      "File path must be provided as a non-empty string"
    );
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    throw new InsomniaParseError(
      `Insomnia YAML file not found at path: ${filePath}`
    );
  }

  try {
    // Read and parse YAML file
    const fileContent = readFileSync(filePath, "utf-8");
    const parsedYaml = parse(fileContent);

    // Validate required top-level fields
    if (!parsedYaml || typeof parsedYaml !== "object") {
      throw new InsomniaParseError(
        "Invalid YAML structure: file must contain a valid object"
      );
    }

    if (!parsedYaml.type || typeof parsedYaml.type !== "string") {
      throw new InsomniaParseError(
        'Invalid YAML structure: missing or invalid "type" field'
      );
    }

    if (!parsedYaml.name || typeof parsedYaml.name !== "string") {
      throw new InsomniaParseError(
        'Invalid YAML structure: missing or invalid "name" field'
      );
    }

    if (!parsedYaml.meta || typeof parsedYaml.meta !== "object") {
      throw new InsomniaParseError(
        'Invalid YAML structure: missing or invalid "meta" field'
      );
    }

    if (!parsedYaml.collection || !Array.isArray(parsedYaml.collection)) {
      throw new InsomniaParseError(
        'Invalid YAML structure: missing or invalid "collection" field'
      );
    }

    // Create the configuration object
    const config = new InsomniaConfig({
      type: parsedYaml.type,
      name: parsedYaml.name,
      meta: parsedYaml.meta,
      collection: parsedYaml.collection,
      cookieJar: parsedYaml.cookieJar,
      environments: parsedYaml.environments,
      envOverrides: envOverrides,
    });

    // Parse and add collection items
    const collectionItems = parseCollectionItems(parsedYaml.collection);
    collectionItems.forEach((item) => config.collection.addItem(item));

    return config;
  } catch (error) {
    if (error instanceof InsomniaParseError) {
      throw error;
    }

    // Handle YAML parsing errors or file reading errors
    throw new InsomniaParseError(
      `Failed to parse Insomnia YAML file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      error instanceof Error ? error : undefined
    );
  }
}
