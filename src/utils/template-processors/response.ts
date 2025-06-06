// CHANGELOG: [2025-06-04] - Created modular response template processing for script templates
// CHANGELOG: [2025-06-04] - Fixed chained pre-request execution by using per-client execution context
// CHANGELOG: [2025-06-06] - Enhanced template format to support XPath and expiry modes

import type { ResponseTemplate, ExpiryMode } from "../../@types/utils";
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
 * Processes a response template with parsed arguments supporting new enhanced format
 * Template format: {% response ${from_where} ${request_id} ${jsonpath/xpath} ${re_trigger_request_mode} ${expired_time} %}
 * @param args - Array of template arguments starting with 'response'
 * @param client - The InsomniaClient instance
 * @returns Promise resolving to the resolved template value
 * @example
 * ```typescript
 * // Basic usage
 * const result = await processResponseTemplate(['response', 'body', 'req_123'], client);
 * 
 * // With JSONPath
 * const token = await processResponseTemplate(['response', 'body', 'req_123', 'JC5hY2Nlc3NfdG9rZW4=', 'when-expired', '60'], client);
 * 
 * // With XPath (base64 encoded)
 * const xml = await processResponseTemplate(['response', 'body', 'req_456', 'Ly9yZXNwb25zZS90b2tlbg==', 'always', '300'], client);
 * ```
 */
export async function processResponseTemplate(
  args: string[],
  client: InsomniaClient
): Promise<string> {
  // Enhanced format: ['response', field, requestId, base64EncodedPath, expiryMode, maxAge]
  // args[0] should be 'response'
  // args[1] should be the field (e.g., 'body', 'header', 'url')
  // args[2] should be the request ID
  // args[3] (optional) should be base64 encoded JSONPath or XPath
  // args[4] (optional) should be expiry mode ('when-expired', 'never', 'no-history', 'always')
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
  let xPath: string | undefined;
  let expiryMode: ExpiryMode | undefined;
  let maxAge: number | undefined;

  // Parse the base64 encoded path (arg[3]) if provided
  if (args[3] && args[3].trim() !== '') {
    let pathContent = args[3];
    
    // Check if it's in Insomnia base64 format: b64::${content}::46b
    if (pathContent.startsWith('b64::') && pathContent.endsWith('::46b')) {
      try {
        // Extract the base64 content between b64:: and ::46b
        const base64Content = pathContent.slice(5, -5); // Remove 'b64::' and '::46b'
        pathContent = atob(base64Content);
      } catch (error) {
        console.warn(`Failed to decode Insomnia base64 format: ${args[3]}`, error);
        // Keep original value as fallback
        pathContent = args[3];
      }
    }
    
    // Now determine if it's XPath or JSONPath
    if (pathContent.startsWith('/') || pathContent.includes('//') || pathContent.includes('@')) {
      xPath = pathContent;
    } else {
      // Treat as JSONPath
      jsonPath = pathContent;
    }
  }

  // Parse expiry mode (arg[4]) if provided
  if (args[4] && args[4].trim() !== '') {
    const mode = args[4] as ExpiryMode;
    if (['when-expired', 'never', 'no-history', 'always'].includes(mode)) {
      expiryMode = mode;
    }
  }

  // Parse maxAge (arg[5]) if provided
  if (args[5] && args[5].trim() !== '') {
    const age = parseInt(args[5], 10);
    if (!isNaN(age) && age > 0) {
      maxAge = age;
    }
  }

  // Create the response template
  const template: ResponseTemplate = {
    requestId,
    field,
    jsonPath,
    xPath,
    expiryMode,
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
  const { requestId, field, jsonPath, xPath, expiryMode, maxAge } = template;

  // Create cache key for this specific template
  const cacheKey = `response_template:${requestId}:${field}:${
    jsonPath || xPath || "none"
  }:${expiryMode || "default"}`;

  // Check if we have cached data that's still valid based on expiry mode
  if (shouldUseCache(expiryMode, maxAge) && (await client.hasCachedValue(cacheKey))) {
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
  const { field, jsonPath, xPath, expiryMode, maxAge } = template;

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

  // Apply JSONPath extraction if specified
  if (jsonPath && extractedValue) {
    extractedValue = extractJsonPath(extractedValue, jsonPath);
  }
  // Apply XPath extraction if specified
  else if (xPath && extractedValue) {
    extractedValue = extractXPath(extractedValue, xPath);
  }

  // Convert to string
  const stringValue =
    extractedValue !== undefined ? String(extractedValue) : "";

  // Cache the result based on expiry mode and maxAge
  if (shouldCacheResult(expiryMode, maxAge) && client && cacheKey) {
    const ttl = maxAge ? maxAge * 1000 : undefined; // Convert seconds to milliseconds
    await client.setCachedValue(cacheKey, stringValue, ttl);
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

/**
 * Extracts a value from XML/HTML content using an XPath expression
 * @param content - The XML/HTML content as string
 * @param xpath - The XPath expression
 * @returns The extracted value
 */
function extractXPath(content: any, xpath: string): any {
  if (!content || !xpath) return content;

  // Convert content to string if it's not already
  let xmlString = typeof content === 'string' ? content : String(content);
  
  try {
    // Simple XPath implementation for basic use cases
    // This is a minimal implementation - for full XPath support, consider using a dedicated library
    
    // Handle simple element selection like //element or /root/element
    if (xpath.includes('//')) {
      // Extract element name from XPath like //token -> token
      const elementMatch = xpath.match(/\/\/([a-zA-Z0-9_-]+)/);
      if (elementMatch) {
        const elementName = elementMatch[1];
        const regex = new RegExp(`<${elementName}[^>]*>([^<]*)<\/${elementName}>`, 'i');
        const match = xmlString.match(regex);
        return match && match[1] ? match[1].trim() : undefined;
      }
    }
    
    // Handle attribute selection like //element/@attribute
    if (xpath.includes('@')) {
      const attrMatch = xpath.match(/\/\/([a-zA-Z0-9_-]+)\/@([a-zA-Z0-9_-]+)/);
      if (attrMatch) {
        const elementName = attrMatch[1];
        const attrName = attrMatch[2];
        const regex = new RegExp(`<${elementName}[^>]*${attrName}=["']([^"']*)["'][^>]*>`, 'i');
        const match = xmlString.match(regex);
        return match && match[1] ? match[1] : undefined;
      }
    }
    
    // Handle simple path like /root/element
    if (xpath.startsWith('/') && !xpath.startsWith('//')) {
      const pathParts = xpath.split('/').filter(part => part.length > 0);
      let currentContent = xmlString;
      
      for (const part of pathParts) {
        const regex = new RegExp(`<${part}[^>]*>([\s\S]*?)<\/${part}>`, 'i');
        const match = currentContent.match(regex);
        if (match && match[1] !== undefined) {
          currentContent = match[1];
        } else {
          return undefined;
        }
      }
      
      return currentContent.trim();
    }
    
    console.warn(`Unsupported XPath expression: ${xpath}`);
    return undefined;
    
  } catch (error) {
    console.warn(`Failed to extract XPath ${xpath}:`, error);
    return undefined;
  }
}

/**
 * Determines whether to use cached data based on expiry mode
 * @param expiryMode - The expiry mode setting
 * @param maxAge - The maximum age setting
 * @returns Whether to use cached data
 */
function shouldUseCache(expiryMode?: ExpiryMode, maxAge?: number): boolean {
  switch (expiryMode) {
    case 'never':
      return true; // Always use cache if available
    case 'always':
      return false; // Never use cache, always refetch
    case 'no-history':
      return false; // Don't use historical cache
    case 'when-expired':
    default:
      return Boolean(maxAge); // Use cache only if maxAge is specified
  }
}

/**
 * Determines whether to cache the result based on expiry mode
 * @param expiryMode - The expiry mode setting
 * @param maxAge - The maximum age setting
 * @returns Whether to cache the result
 */
function shouldCacheResult(expiryMode?: ExpiryMode, maxAge?: number): boolean {
  switch (expiryMode) {
    case 'never':
      return true; // Cache indefinitely
    case 'always':
      return true; // Cache but will be ignored on reads
    case 'no-history':
      return false; // Don't cache at all
    case 'when-expired':
    default:
      return Boolean(maxAge); // Cache only if maxAge is specified
  }
}