// CHANGELOG: [2025-01-04] - Created env utility for parsing .env files with type conversion

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// CHANGELOG: [2025-06-04] - Refactored to import types from @types directory

import type { EnvVariables, ReadEnvOptions } from "../@types/utils/index";

/**
 * Parses a single environment variable value to its appropriate type
 * @param value - The raw string value from the .env file
 * @returns The parsed value as string, number, boolean, or null
 * @example
 * ```typescript
 * const parsed = parseEnvValue("true"); // returns boolean true
 * const parsed2 = parseEnvValue("123"); // returns number 123
 * ```
 */
export function parseEnvValue(value: string): string | number | boolean | null {
  // Handle empty or undefined values
  if (!value || value.trim() === "") {
    return null;
  }

  const trimmedValue = value.trim();

  // Parse boolean values (case-insensitive)
  if (trimmedValue.toLowerCase() === "true") {
    return true;
  }
  if (trimmedValue.toLowerCase() === "false") {
    return false;
  }

  // Parse null/undefined values
  if (
    trimmedValue.toLowerCase() === "null" ||
    trimmedValue.toLowerCase() === "undefined"
  ) {
    return null;
  }

  // Parse numeric values (integers and floats)
  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    const numValue = Number(trimmedValue);
    // Check if it's a valid number and not NaN
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }
  }

  // Remove quotes if present (both single and double)
  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  // Return as string for everything else
  return trimmedValue;
}

/**
 * Reads and parses a .env file with automatic type conversion
 * @param options - Configuration options for reading the env file
 * @returns Object containing parsed environment variables with proper types
 * @throws {Error} When file is required but doesn't exist
 * @example
 * ```typescript
 * // Read from default location (process.cwd()/.env)
 * const env = readEnvFile();
 *
 * // Read from specific path
 * const env = readEnvFile({ path: '/path/to/custom.env' });
 *
 * // Type-safe reading with generic interface
 * const env = readEnvFile<{
 *   API_PORT?: number;
 *   DEBUG_MODE?: boolean;
 *   API_URL: string;
 * }>();
 * ```
 */
export function readEnvFile<T = EnvVariables>(options: ReadEnvOptions = {}): T {
  const { path, required = false } = options;

  // Determine the file path - use provided path or default to process.cwd()/.env
  const envPath = path || join(process.cwd(), ".env");

  // Check if file exists
  if (!existsSync(envPath)) {
    if (required) {
      throw new Error(`Environment file not found: ${envPath}`);
    }
    // Return empty object if file doesn't exist and not required
    return {} as T;
  }

  try {
    // Read the file content
    const fileContent = readFileSync(envPath, "utf-8");
    const envVariables: EnvVariables = {};

    // Split into lines and process each one
    const lines = fileContent.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip if line is undefined (shouldn't happen with array access, but TypeScript requires check)
      if (line === undefined) {
        continue;
      }
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      // Find the first equals sign to split key and value
      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex === -1) {
        // Skip malformed lines without equals sign
        continue;
      }

      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1);

      // Skip if key is empty
      if (!key) {
        continue;
      }

      // Parse the value and store in the result object
      envVariables[key] = parseEnvValue(value);
    }

    return envVariables as T;
  } catch (error) {
    if (required) {
      // Safely handle the error object which could be any type
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read environment file: ${envPath}. ${errorMessage}`
      );
    }
    // Return empty object if there's an error and file is not required
    return {} as T;
  }
}

/**
 * Utility function to merge environment variables with process.env
 * @param envVars - The parsed environment variables
 * @param overwrite - Whether to overwrite existing process.env values
 * @example
 * ```typescript
 * const env = readEnvFile();
 * mergeWithProcessEnv(env, false); // Don't overwrite existing values
 * ```
 */
export function mergeWithProcessEnv(
  envVars: EnvVariables,
  overwrite: boolean = false
): void {
  for (const [key, value] of Object.entries(envVars)) {
    // Only set if the key doesn't exist in process.env or overwrite is true
    if (overwrite || !(key in process.env)) {
      process.env[key] = String(value);
    }
  }
}
