// CHANGELOG: [2025-06-06] - Created prompt template processor for interactive user input

import type { InsomniaClient } from "../../insomnia-client";

/**
 * Processes a prompt template with interactive user input
 * Template format: {% prompt ${prompt_title}, ${prompt_label}, ${default_value}, ${cache_key}, ${is_secret}, ${default_to_cached_value} %}
 * @param args - Array of template arguments starting with 'prompt'
 * @param client - The InsomniaClient instance for cache operations
 * @returns Promise resolving to the user input value
 * @example
 * ```typescript
 * // Basic prompt
 * const apiKey = await processPromptTemplate(['prompt', 'API Configuration', 'Enter API Key:', '', 'api_key', 'true', 'false'], client);
 * 
 * // With default value and caching
 * const username = await processPromptTemplate(['prompt', 'Login', 'Username:', 'admin', 'username', 'false', 'true'], client);
 * 
 * // Secret input with caching
 * const password = await processPromptTemplate(['prompt', 'Authentication', 'Password:', '', 'password', 'true', 'true'], client);
 * ```
 */
export async function processPromptTemplate(
  args: string[],
  client: InsomniaClient
): Promise<string> {
  // args[0] should be 'prompt'
  // args[1] should be the prompt title
  // args[2] should be the prompt label
  // args[3] should be the default value
  // args[4] should be the cache key
  // args[5] should be is_secret (boolean)
  // args[6] should be default_to_cached_value (boolean)

  if (args.length < 7) {
    throw new Error(
      `Invalid prompt template: expected 7 arguments, got ${args.length}`
    );
  }

  const promptTitle = args[1] || "Input Required";
  const promptLabel = args[2] || "Enter value:";
  const defaultValue = args[3] || "";
  const cacheKey = args[4] || "";
  const isSecret = args[5]?.toLowerCase() === "true";
  const defaultToCachedValue = args[6]?.toLowerCase() === "true";

  // Create cache key for prompt values with prefix
  const fullCacheKey = cacheKey ? `prompt:${cacheKey}` : null;

  // Check for cached value first if requested
  if (defaultToCachedValue && fullCacheKey) {
    try {
      const hasCached = await client.hasCachedValue(fullCacheKey);
      if (hasCached) {
        const cachedValue = await client.getCachedValue(fullCacheKey);
        if (cachedValue !== undefined && cachedValue !== null) {
          console.log(`📋 Using cached value for "${promptLabel}"`);
          return String(cachedValue);
        }
      }
    } catch (error) {
      console.warn(`Failed to retrieve cached value for ${fullCacheKey}:`, error);
    }
  }

  // Display prompt title if provided
  if (promptTitle.trim()) {
    console.log(`\n🔹 ${promptTitle}`);
  }

  // Get user input
  const userInput = await getUserInput(promptLabel, defaultValue, isSecret);

  // Cache the result if cache key is provided (1 minute expiry = 60000ms)
  if (fullCacheKey) {
    try {
      await client.setCachedValue(fullCacheKey, userInput, 60000);
    } catch (error) {
      console.warn(`Failed to cache prompt value for ${fullCacheKey}:`, error);
    }
  }

  return userInput;
}

/**
 * Gets user input from the terminal with optional secret handling
 * @param label - The prompt label to display
 * @param defaultValue - The default value if user provides empty input
 * @param isSecret - Whether to hide the input (for passwords)
 * @returns Promise resolving to the user input
 */
async function getUserInput(
  label: string,
  defaultValue: string,
  isSecret: boolean
): Promise<string> {
  // Display the prompt
  const promptText = defaultValue 
    ? `${label} [${defaultValue}]: `
    : `${label}: `;
  
  process.stdout.write(promptText);

  if (isSecret) {
    // For secret input, we need to handle it specially
    return await getSecretInput();
  } else {
    // For regular input, read from stdin
    return await getRegularInput(defaultValue);
  }
}

/**
 * Gets regular (visible) input from the terminal
 * @param defaultValue - The default value to use if input is empty
 * @returns Promise resolving to the user input
 */
async function getRegularInput(defaultValue: string): Promise<string> {
  return new Promise((resolve) => {
    // Only set raw mode if it's available
    if (typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(false);
    }
    process.stdin.setEncoding('utf8');
    
    const onData = (data: string) => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      
      const input = data.toString().trim();
      resolve(input || defaultValue);
    };
    
    process.stdin.resume();
    process.stdin.once('data', onData);
  });
}

/**
 * Gets secret (hidden) input from the terminal
 * @returns Promise resolving to the secret input
 */
async function getSecretInput(): Promise<string> {
  return new Promise((resolve) => {
    let input = '';
    
    // Check if setRawMode is available, if not, fall back to regular input
    if (typeof process.stdin.setRawMode !== 'function') {
      console.warn('Secret input mode not available, falling back to regular input');
      return getRegularInput('').then(resolve);
    }
    
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    
    const onData = (char: string) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          // Enter pressed, finish input
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n'); // Move to next line
          resolve(input);
          break;
        
        case '\u0003': // Ctrl+C
          // Handle Ctrl+C gracefully
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(0);
          break;
        
        case '\u007f': // Backspace
        case '\b':
          // Handle backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b'); // Erase character visually
          }
          break;
        
        default:
          // Regular character
          if (char >= ' ' && char <= '~') { // Printable ASCII characters
            input += char;
            process.stdout.write('*'); // Show asterisk for each character
          }
          break;
      }
    };
    
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}