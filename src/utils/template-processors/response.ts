// CHANGELOG: [2025-06-04] - Created modular response template processing for script templates
// CHANGELOG: [2025-06-04] - Fixed chained pre-request execution by using per-client execution context

import type { ResponseTemplate } from "../../@types/utils";
import type { InsomniaClient } from "../../insomnia-client";

/**
 * Tracks request execution to prevent infinite recursion per client instance
 * Using WeakMap to ensure proper cleanup when client instances are garbage collected
 */
const executionStacks = new WeakMap<InsomniaClient, Set<string>>();

/**
 * Gets or creates an execution stack for a specific client instance
 * @param client - The InsomniaClient instance
 * @returns The execution stack for this client
 */
function getExecutionStack(client: InsomniaClient): Set<string> {
  let stack = executionStacks.get(client);
  if (!stack) {
    stack = new Set<string>();
    executionStacks.set(client, stack);
  }
  return stack;
}

/**
 * Processes a response template with parsed arguments
 * @param args - Array of template arguments starting with 'response'
 * @param client - The InsomniaClient instance
 * @returns Promise resolving to the resolved template value
 */
export async function processResponseTemplate(
  args: string[],
  client: InsomniaClient
): Promise<string> {
  // args[0] should be 'response'
  // args[1] should be the field (e.g., 'body', 'json', 'status')
  // args[2] should be the request ID
  // args[3] (optional) should be the JSON path or filter
  // args[4] (optional) should be additional filter or 'when-expired'
  // args[5] (optional) should be maxAge in seconds

  if (args.length < 3) {
    throw new Error(
      `Invalid response template: expected at least 3 arguments, got ${args.length}`
    );
  }

  const field = args[1];
  const requestId = args[2];

  if (!field || !requestId) {
    throw new Error(
      `Invalid response template: field and requestId are required`
    );
  }

  let jsonPath: string | undefined;
  let filter: string | undefined;
  let maxAge: number | undefined;

  // Parse optional arguments based on their content
  for (let i = 3; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    // Check if it's a base64 encoded JSON path (do this first!)
    if (arg.startsWith("b64::") && arg.endsWith("::46b")) {
      // Decode the base64 content and use it as JSON path
      const base64Content = arg.slice(5, -5); // Remove 'b64::' and '::46b'
      try {
        const decodedPath = atob(base64Content);
        jsonPath = decodedPath;
      } catch (error) {
        console.warn(`Failed to decode base64 argument: ${arg}`, error);
        // Fallback to treating it as a regular filter
        filter = arg;
      }
    }
    // Check if it's a number (maxAge)
    else if (/^\d+$/.test(arg)) {
      maxAge = parseInt(arg, 10);
    }
    // Check if it's 'when-expired' or 'never' flags
    else if (arg === "when-expired" || arg === "never") {
      // These are cache behavior flags, handled by maxAge presence
      continue;
    }
    // Otherwise, treat it as a JSON path (only if we don't have one yet)
    else if (!jsonPath) {
      jsonPath = arg;
    }
    // If we already have a jsonPath, treat it as a filter
    else {
      filter = arg;
    }
  }

  // Create the response template
  const template: ResponseTemplate = {
    requestId,
    field,
    jsonPath,
    filter,
    maxAge,
  };

  // Get the resolved value for this template
  return await resolveResponseTemplate(template, client);
}

/**
 * Resolves a response template by executing the referenced request and extracting data
 * @param template - The parsed response template
 * @param client - The InsomniaClient instance for making pre-requests
 * @returns Promise resolving to the extracted value as string
 */
async function resolveResponseTemplate(
  template: ResponseTemplate,
  client: InsomniaClient
): Promise<string> {
  const { requestId, field, jsonPath, filter, maxAge } = template;

  // Create cache key for this specific template
  const cacheKey = `response_template:${requestId}:${field}:${
    jsonPath || "none"
  }:${filter || "none"}`;

  // Check if we have cached data that's still valid
  if (maxAge && (await client.hasCachedValue(cacheKey))) {
    const cachedValue = await client.getCachedValue(cacheKey);
    if (cachedValue !== undefined && cachedValue) {
      return String(cachedValue);
    }
  }

  // Find the request path for the given request ID
  const requestPath = client.findRequestPathById(requestId);
  if (!requestPath) {
    throw new Error(
      `Request with ID '${requestId}' not found in configuration`
    );
  }

  // Get execution stack for this client instance
  const executionStack = getExecutionStack(client);
  
  // Check for circular dependencies to prevent infinite recursion
  if (executionStack.has(requestId)) {
    throw new Error(
      `Circular dependency detected: Request '${requestId}' is already being executed`
    );
  }

  // Execute the pre-request to get the response
  console.log(`🔄 Executing pre-request for template: ${requestPath}`);

  // Add to execution stack to track circular dependencies
  executionStack.add(requestId);

  try {
    const response = await client.request(requestPath);
    // Remove from execution stack after successful execution
    executionStack.delete(requestId);
    return await processResponseForTemplate(
      response,
      template,
      client,
      cacheKey
    );
  } catch (error) {
    // Remove from execution stack even if request fails
    executionStack.delete(requestId);
    throw error;
  }
}

/**
 * Processes the response and extracts the required value based on the template
 * @param response - The HTTP response from the pre-request
 * @param template - The response template configuration
 * @param client - The InsomniaClient instance for caching
 * @param cacheKey - The cache key for storing the result
 * @returns Promise resolving to the extracted value as string
 */
async function processResponseForTemplate(
  response: any,
  template: ResponseTemplate,
  client?: InsomniaClient,
  cacheKey?: string
): Promise<string> {
  const { field, jsonPath, filter, maxAge } = template;

  // Extract the required field from the response
  let extractedValue: any;

  switch (field.toLowerCase()) {
    case "body":
      extractedValue = response.body;
      break;
    case "json":
      extractedValue = response.json;
      break;
    case "status":
      extractedValue = response.status;
      break;
    case "statustext":
      extractedValue = response.statusText;
      break;
    case "url":
      extractedValue = response.url;
      break;
    case "method":
      extractedValue = response.method;
      break;
    case "duration":
      extractedValue = response.duration;
      break;
    default:
      // Check if it's a header
      extractedValue =
        response.headers[field] || response.headers[field.toLowerCase()];
      break;
  }

  // Apply JSON path extraction if specified
  if (jsonPath && extractedValue) {
    extractedValue = extractJsonPath(extractedValue, jsonPath);
  }

  // Apply additional filters if specified (future extensibility)
  if (filter) {
    // Future: Add support for other filter types here
    console.log(`Filter not yet implemented: ${filter}`);
  }

  // Convert to string
  const stringValue =
    extractedValue !== undefined ? String(extractedValue) : "";

  // Cache the result if maxAge is specified and client is provided
  if (maxAge && client && cacheKey) {
    await client.setCachedValue(cacheKey, stringValue, maxAge * 1000); // Convert seconds to milliseconds
  }

  return stringValue;
}

/**
 * Extracts a value from an object using a JSON path
 * @param obj - The object to extract from
 * @param path - The JSON path (e.g., "$.access_token" or ".access_token")
 * @returns The extracted value
 */
function extractJsonPath(obj: any, path: string): any {
  if (!obj || !path) return obj;

  // If obj is a string, try to parse it as JSON first
  let current = obj;
  if (typeof obj === "string") {
    try {
      current = JSON.parse(obj);
    } catch (error) {
      // If parsing fails, treat it as a regular string
      // and return undefined since we can't traverse a string with a path
      return undefined;
    }
  }

  // Remove leading $ or . if present
  const cleanPath = path.replace(/^\$?\.?/, "");

  // Split the path and traverse the object
  const pathParts = cleanPath.split(".");

  for (const part of pathParts) {
    // Check if current is null/undefined first
    if (current == null) {
      return undefined;
    }

    // Check if current is an object and has the property
    if (typeof current === "object" && part in current) {
      current = current[part];
    } else {
      // If current is not an object or doesn't have the property, path is invalid
      return undefined;
    }
  }

  return current;
}