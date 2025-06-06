// CHANGELOG: [2025-06-06] - Created cookie template processor for {% cookie %} templates

import type { InsomniaClient } from "../../insomnia-client";
import { InsomniaTemplateResolver } from "../insomnia/template-resolver";

/**
 * Processes a cookie template with URL and key parameters
 * Template format: {% cookie ${url} ${key} %}
 * @param args - Array of template arguments starting with 'cookie'
 * @param client - The InsomniaClient instance
 * @returns Promise resolving to the cookie value or empty string if not found
 * @example
 * ```typescript
 * // Basic usage
 * const sessionValue = await processCookieTemplate(['cookie', 'https://example.com', 'session'], client);
 * 
 * // With environment variable for URL
 * const tokenValue = await processCookieTemplate(['cookie', '_.API_URL', 'auth_token'], client);
 * 
 * // With environment variable for key
 * const cookieValue = await processCookieTemplate(['cookie', 'https://api.com', '_.COOKIE_NAME'], client);
 * ```
 */
export async function processCookieTemplate(
  args: string[],
  client: InsomniaClient
): Promise<string> {
  // args[0] should be 'cookie'
  // args[1] should be the URL (may contain environment variables like _.URL)
  // args[2] should be the cookie key (may contain environment variables like _.KEY)

  if (args.length < 3) {
    throw new Error(
      `Invalid cookie template: expected 3 arguments, got ${args.length}`
    );
  }

  let url = args[1];
  let key = args[2];

  if (!url || !key) {
    throw new Error(
      `Invalid cookie template: URL and key are required`
    );
  }

  // Resolve environment variables if present
  const envVariables = client.getEnvVariables();
  if (envVariables) {
    // Create a mock environment for template resolution
    const mockEnvironment = {
      getVariable: (name: string) => envVariables[name]?.toString(),
      hasVariable: (name: string) => name in envVariables
    };
    
    const resolver = new InsomniaTemplateResolver(mockEnvironment as any);
    
    // Convert _.VARIABLE format to {{ _.VARIABLE }} format for resolution
    if (url.startsWith('_.')) {
      url = `{{ ${url} }}`;
      url = resolver.resolve(url);
    }
    
    if (key.startsWith('_.')) {
      key = `{{ ${key} }}`;
      key = resolver.resolve(key);
    }
  }

  // Extract domain from URL for cookie lookup
  const domain = extractDomainFromUrl(url);
  if (!domain) {
    throw new Error(`Invalid URL for cookie template: ${url}`);
  }

  try {
    // Get the cookie from the client's cookie driver
    const cookie = await client.getCookie(key, domain);
    
    if (cookie && cookie.value) {
      return cookie.value;
    }
    
    // If not found, try without protocol/subdomain variations
    const alternatives = generateDomainAlternatives(domain);
    for (const altDomain of alternatives) {
      const altCookie = await client.getCookie(key, altDomain);
      if (altCookie && altCookie.value) {
        return altCookie.value;
      }
    }
    
    console.warn(`Cookie '${key}' not found for domain '${domain}'`);
    return "";
    
  } catch (error) {
    console.warn(`Failed to retrieve cookie '${key}' for domain '${domain}':`, error);
    return "";
  }
}

/**
 * Extracts the domain from a URL for cookie matching
 * @param url - The URL to extract domain from
 * @returns The domain string or null if invalid
 * @example
 * ```typescript
 * extractDomainFromUrl("https://api.example.com/path") // "api.example.com"
 * extractDomainFromUrl("http://localhost:3000") // "localhost"
 * extractDomainFromUrl("example.com") // "example.com"
 * ```
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    // Handle URLs without protocol
    if (!url.includes('://')) {
      // Check if it's already a domain (no path)
      if (!url.includes('/') && url.includes('.')) {
        return url;
      }
      // Add protocol for URL parsing
      url = `https://${url}`;
    }
    
    const urlObj = new URL(url);
    return urlObj.hostname ?? null;
  } catch (error) {
    // Fallback for simple domain strings
    const domainMatch = url.match(/^([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/.*)?\??$/);
    return domainMatch?.[1] ?? null;
  }
}

/**
 * Generates alternative domain formats for cookie matching
 * @param domain - The primary domain to generate alternatives for
 * @returns Array of alternative domain formats to try
 * @example
 * ```typescript
 * generateDomainAlternatives("api.example.com")
 * // ["example.com", ".example.com", ".api.example.com"]
 * ```
 */
function generateDomainAlternatives(domain: string): string[] {
  const alternatives: string[] = [];
  
  // Remove port if present
  const cleanDomain = domain.split(':')[0];
  if (!cleanDomain) {
    return alternatives;
  }
  
  // Add dot-prefixed version (common for cookie domains)
  alternatives.push(`.${cleanDomain}`);
  
  // For subdomains, try the parent domain
  const parts = cleanDomain.split('.');
  if (parts.length > 2) {
    // For api.example.com, try example.com
    const parentDomain = parts.slice(1).join('.');
    alternatives.push(parentDomain);
    alternatives.push(`.${parentDomain}`);
  }
  
  return alternatives;
}