// CHANGELOG: [2025-06-04] - Implemented ParseScriptTemplate with response template support and pre-request execution

import type { ResolvedRequestNode } from "../@types/client";
import type { InsomniaClient } from "../insomnia-client";

/**
 * Tracks request execution to prevent infinite recursion
 */
const executionStack = new Set<string>();

/**
 * Interface for parsed response template
 */
interface ResponseTemplate {
  requestId: string;
  field: string;
  jsonPath?: string;
  filter?: string;
  maxAge?: number;
}

/**
 * Parses script templates in request data and executes pre-requests when needed
 * Handles {% response %} templates that reference other requests
 * @param payload - The resolved request node to process
 * @param client - The InsomniaClient instance for making pre-requests
 * @returns Promise resolving to the processed request node with template variables resolved
 * @example
 * ```typescript
 * // Template: {% response 'body', 'req_123', 'b64::JC5hY2Nlc3NfdG9rZW4=::46b', 'when-expired', 60 %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: Access token extracted from response body of req_123
 * ```
 */
export async function ParseScriptTemplate(
  payload: ResolvedRequestNode,
  client: InsomniaClient
): Promise<ResolvedRequestNode> {
  // Clone the payload to avoid modifying the original
  const processedPayload = JSON.parse(
    JSON.stringify(payload)
  ) as ResolvedRequestNode;

  // Process URL templates
  if (processedPayload.url) {
    processedPayload.url = await processTemplateString(
      processedPayload.url,
      client
    );
  }

  // Process header templates
  if (processedPayload.headers) {
    for (const header of processedPayload.headers) {
      if (header.name) {
        header.name = await processTemplateString(header.name, client);
      }
      if (header.value) {
        header.value = await processTemplateString(header.value, client);
      }
    }
  }

  // Process body templates
  if (processedPayload.body?.text) {
    processedPayload.body.text = await processTemplateString(
      processedPayload.body.text,
      client
    );
  }

  if (processedPayload.body?.params) {
    for (const param of processedPayload.body.params) {
      param.name = await processTemplateString(param.name, client);
      param.value = await processTemplateString(param.value, client);
    }
  }

  // Process authentication templates
  if (processedPayload.authentication) {
    if (processedPayload.authentication.token) {
      processedPayload.authentication.token = await processTemplateString(
        processedPayload.authentication.token,
        client
      );
    }
    if (processedPayload.authentication.username) {
      processedPayload.authentication.username = await processTemplateString(
        processedPayload.authentication.username,
        client
      );
    }
    if (processedPayload.authentication.password) {
      processedPayload.authentication.password = await processTemplateString(
        processedPayload.authentication.password,
        client
      );
    }
  }
  return processedPayload;
}

/**
 * Processes template strings and replaces {% response %} templates with actual data
 * @param input - The input string that may contain templates
 * @param client - The InsomniaClient instance for making pre-requests
 * @returns Promise resolving to the processed string with templates resolved
 */
async function processTemplateString(
  input: string,
  client: InsomniaClient
): Promise<string> {
  // Regular expression to match any template between {% and %}
  const templateRegex = /\{\%\s*([^%]+)\s*\%\}/g;

  let result = input;
  let match;

  // Process all templates in the string
  while ((match = templateRegex.exec(input)) !== null) {
    const [fullMatch, templateContent] = match;

    if (!templateContent) {
      console.warn(`Empty template content: ${fullMatch}`);
      continue;
    }

    try {
      // Parse the template content into arguments
      const args = parseTemplateArguments(templateContent.trim());

      // Check if this is a response template
      if (args.length > 0 && args[0] === "response") {
        const resolvedValue = await processResponseTemplate(args, client);
        // Replace the template with the resolved value
        result = result.replace(fullMatch, resolvedValue);
      }
      // Future: Add support for other template types here
    } catch (error) {
      console.warn(`Failed to resolve template: ${fullMatch}`, error);
      // Leave the template unchanged if resolution fails
    }
  }

  return result;
}

/**
 * Parses template arguments, handling quoted and unquoted values
 * @param content - The template content between {% and %}
 * @returns Array of parsed arguments
 * @example
 * ```typescript
 * parseTemplateArguments("response 'body', 'req_123', 'path'")
 * // Returns: ["response", "body", "req_123", "path"]
 * ```
 */
function parseTemplateArguments(content: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (!inQuotes) {
      // Not in quotes
      if (char === '"' || char === "'") {
        // Start of quoted string
        inQuotes = true;
        quoteChar = char;
      } else if (char === " " || char === ",") {
        // Delimiter - add current arg if not empty
        if (current.trim()) {
          args.push(current.trim());
          current = "";
        }
      } else {
        // Regular character
        current += char;
      }
    } else {
      // In quotes
      if (char === quoteChar) {
        // End of quoted string
        inQuotes = false;
        quoteChar = "";
      } else {
        // Character within quotes
        current += char;
      }
    }

    i++;
  }

  // Add the last argument if not empty
  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Processes a response template with parsed arguments
 * @param args - Array of template arguments starting with 'response'
 * @param client - The InsomniaClient instance
 * @returns Promise resolving to the resolved template value
 */
async function processResponseTemplate(
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

    // Check if it's a number (maxAge)
    if (/^\d+$/.test(arg)) {
      maxAge = parseInt(arg, 10);
    }
    // Check if it's 'when-expired' flag
    else if (arg === "when-expired") {
      // This is just a flag, handled by maxAge presence
      continue;
    }
    // Check if it's a base64 encoded JSON path
    else if (arg.startsWith("b64::") && arg.endsWith("::46b")) {
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
    // Otherwise, treat it as a JSON path
    else {
      jsonPath = arg;
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
