// CHANGELOG: [2025-06-04] - Created centralized utils type definitions

/**
 * Represents the parsed environment variables with their proper types
 */
export interface EnvVariables {
  [key: string]: string | number | boolean | null;
}

/**
 * Options for reading environment files
 */
export interface ReadEnvOptions {
  /** The path to the .env file. Defaults to process.cwd()/.env */
  path?: string;
  /** Whether to throw an error if the file doesn't exist. Defaults to false */
  required?: boolean;
}

/**
 * Options for template resolution
 */
export interface TemplateResolverOptions {
  /** Whether to throw an error for undefined variables (default: false) */
  strict?: boolean;
  /** Custom replacement for undefined variables (default: original template) */
  undefinedReplacement?: string;
}