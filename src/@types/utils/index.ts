// CHANGELOG: [2025-06-04] - Created centralized utils type definitions
// CHANGELOG: [2025-06-04] - Added script template parser types and interfaces

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

/**
 * Interface for parsed response template
 */
export interface ResponseTemplate {
  requestId: string;
  field: string;
  jsonPath?: string;
  filter?: string;
  maxAge?: number;
}

/**
 * Supported faker data types
 */
export type FakerType = 'randomEmail' | 'randomFullName' | 'randomUserName';

/**
 * Template types that can be processed
 */
export type TemplateType = 'response' | 'faker';

/**
 * Options for processing script templates
 */
export interface ScriptTemplateOptions {
  /** Whether to cache template results */
  enableCaching?: boolean;
  /** Default cache TTL in seconds */
  defaultCacheTtl?: number;
}