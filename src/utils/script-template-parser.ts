// CHANGELOG: [2025-06-04] - Implemented ParseScriptTemplate with response template support and pre-request execution
// CHANGELOG: [2025-06-04] - Added faker template support for randomEmail, randomFullName, randomUserName
// CHANGELOG: [2025-06-04] - Refactored into modular components for better maintainability
// CHANGELOG: [2025-06-06] - Updated template processing to use switch case structure for better extensibility
// CHANGELOG: [2025-06-06] - Added cookie template support with environment variable resolution
// CHANGELOG: [2025-06-06] - Added prompt template support for interactive user input

import type { ResolvedRequestNode } from "../@types/client";
import type { InsomniaClient } from "../insomnia-client";
import { parseTemplateArguments } from "./template-processors/parser";
import { processFakerTemplate } from "./template-processors/faker";
import { processResponseTemplate } from "./template-processors/response";
import { processCookieTemplate } from "./template-processors/cookie";
import { processPromptTemplate } from "./template-processors/prompt";

/**
 * Parses script templates in request data and executes pre-requests when needed
 * Handles {% response %}, {% faker %}, {% cookie %}, and {% prompt %} templates
 * @param payload - The resolved request node to process
 * @param client - The InsomniaClient instance for making pre-requests
 * @returns Promise resolving to the processed request node with template variables resolved
 * @example
 * ```typescript
 * // Template: {% response 'body', 'req_123', 'b64::JC5hY2Nlc3NfdG9rZW4=::46b', 'when-expired', 60 %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: Access token extracted from response body of req_123
 * 
 * // Template: {% faker 'randomEmail' %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: Random email like "user123@example.com"
 * 
 * // Template: {% cookie 'https://api.example.com', 'session' %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: Session cookie value from api.example.com
 * 
 * // Template: {% cookie '_.API_URL', '_.COOKIE_NAME' %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: Cookie value using environment variables
 * 
 * // Template: {% prompt 'Login', 'Username:', 'admin', 'username', 'false', 'true' %}
 * const processedNode = await ParseScriptTemplate(requestNode, client);
 * // Result: User-provided username with caching
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
 * Processes template strings and replaces {% response %}, {% faker %}, {% cookie %}, and {% prompt %} templates with actual data
 * @param input - The input string that may contain templates
 * @param client - The InsomniaClient instance for making pre-requests, cookie access, and caching
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

      if (args.length === 0) {
        console.warn(`Empty template arguments: ${fullMatch}`);
        continue;
      }

      // Get the script parser module name (first argument)
      const scriptParserModule = args[0];
      let resolvedValue: string;

      // Process template based on module type
      switch (scriptParserModule) {
        case "response":
          resolvedValue = await processResponseTemplate(args, client);
          break;
        
        case "faker":
          resolvedValue = processFakerTemplate(args);
          break;
        
        case "cookie":
          resolvedValue = await processCookieTemplate(args, client);
          break;
        
        case "prompt":
          resolvedValue = await processPromptTemplate(args, client);
          break;
        
        // Future modules can be added here:
        // case "timestamp":
        //   resolvedValue = processTimestampTemplate(args);
        //   break;
        // case "crypto":
        //   resolvedValue = processCryptoTemplate(args);
        //   break;
        
        default:
          console.warn(`Unsupported script parser module: ${scriptParserModule}`);
          continue;
      }

      // Replace the template with the resolved value
      result = result.replace(fullMatch, resolvedValue);
    } catch (error) {
      console.warn(`Failed to resolve template: ${fullMatch}`, error);
      // Leave the template unchanged if resolution fails
    }
  }

  return result;
}