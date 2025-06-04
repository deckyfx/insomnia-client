#!/usr/bin/env node
// CHANGELOG: [2025-06-04] - Created CLI entry point for insomnia-cli with argument parsing and request execution
// CHANGELOG: [2025-06-04] - Made --config optional when using --interactive mode, allowing users to load config within interactive session
// CHANGELOG: [2025-06-04] - Added 'list' command to list all available request nodes alongside existing 'request list' syntax
// CHANGELOG: [2025-06-04] - Added request headers display in verbose mode to show both sent and received headers

import { InsomniaClient } from "./insomnia-client";
import { FileCacheDriver, InMemoryCacheDriver } from "./cache-drivers/index";
import { FileCookieDriver, InMemoryCookieDriver } from "./cookie-drivers/index";
import { startInteractiveMode } from "./interactive";

/**
 * CLI interface for Insomnia HTTP request testing tool
 * Supports Insomnia configuration format with advanced features like request chaining
 * @example
 * ```bash
 * # Basic usage
 * bun index.ts --config insomnia.yaml request "API/Auth/Login"
 * 
 * # With environment variables
 * bun index.ts --config config.yaml --env .env request "API/Users/GetProfile"
 * 
 * # With persistent storage
 * bun index.ts --config config.yaml --cookie cookies.json --cache .cache request 1
 * ```
 */

interface CliOptions {
  config?: string;
  env?: string;
  cookie?: string;
  cache?: string;
  request?: string;
  list?: boolean;
  interactive?: boolean;
  verbose?: boolean;
  help?: boolean;
}

/**
 * Parses command line arguments into options object
 * @param args - Array of command line arguments
 * @returns Parsed options object
 */
function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--config':
        options.config = args[++i];
        break;
      case '--env':
        options.env = args[++i];
        break;
      case '--cookie':
        options.cookie = args[++i];
        break;
      case '--cache':
        options.cache = args[++i];
        break;
      case 'request':
        options.request = args[++i];
        break;
      case 'list':
        options.list = true;
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        // Skip unknown arguments
        break;
    }
  }
  
  return options;
}

/**
 * Displays help information for the CLI
 */
function showHelp(): void {
  console.log(`
Insomnia CLI - HTTP Request Testing Tool

USAGE:
  bun index.ts [OPTIONS] [COMMAND]

OPTIONS:
  --config <file>      Path to Insomnia YAML configuration file (optional with --interactive)
  --env <file>         Path to environment variables file (optional)
  --cookie <file>      Path to cookie storage file (optional, uses memory if not specified)
  --cache <file>       Path to cache directory (optional, uses memory if not specified)
  --interactive, -i    Enter interactive mode for multiple requests
  --verbose, -v        Show detailed output including headers and response info
  --help, -h           Show this help message

COMMANDS:
  request <path>       Execute a request by path (e.g., "API/Auth/Login") or by number
  list                 List all available request nodes

EXAMPLES:
  # Basic request execution
  bun index.ts --config insomnia.yaml request "API/Auth/Login"

  # With environment variables
  bun index.ts --config config.yaml --env .env request "API/Users/GetProfile"

  # With persistent cookie and cache storage
  bun index.ts --config config.yaml --cookie cookies.json --cache .cache request 1

  # List all available requests
  bun index.ts --config config.yaml list

  # List all available requests (alternative syntax)
  bun index.ts --config config.yaml request list

  # Interactive mode for multiple requests
  bun index.ts --config config.yaml --interactive

  # Interactive mode without pre-loading config (load config within the session)
  bun index.ts --interactive

  # Verbose output with detailed request/response information
  bun index.ts --config config.yaml --verbose request "API/Auth/Login"

FEATURES:
  ✓ Insomnia YAML configuration support
  ✓ Environment variable resolution
  ✓ Request chaining with {% response %} templates
  ✓ Cookie management and persistence
  ✓ Response caching for performance
  ✓ Authentication inheritance from folders
  ✓ Template variable resolution

For more information, visit: https://github.com/your-repo/insomnia-cli
`);
}

/**
 * Lists all available requests in the configuration
 * @param client - The configured InsomniaClient instance
 */
function listRequests(client: InsomniaClient): void {
  const requestPaths = client.getRequestNodePaths();
  
  if (requestPaths.length === 0) {
    console.log("No requests found in configuration.");
    return;
  }
  
  console.log("📋 Available Requests:");
  console.log("=".repeat(50));
  
  requestPaths.forEach((path, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${path}`);
  });
  
  console.log("\n💡 Use request number or full path to execute a request.");
}

/**
 * Executes a specific request
 * @param client - The configured InsomniaClient instance
 * @param requestIdentifier - Request path or number
 * @param verbose - Whether to show detailed output
 */
async function executeRequest(client: InsomniaClient, requestIdentifier: string, verbose: boolean = false): Promise<void> {
  let requestPath: string;
  
  // Check if identifier is a number
  if (/^\d+$/.test(requestIdentifier)) {
    const requestPaths = client.getRequestNodePaths();
    const index = parseInt(requestIdentifier, 10) - 1; // Convert to 0-based index
    
    if (index < 0 || index >= requestPaths.length) {
      console.error(`❌ Error: Request number ${requestIdentifier} is out of range (1-${requestPaths.length})`);
      process.exit(1);
    }
    
    requestPath = requestPaths[index] || "";
    if (!requestPath) {
      console.error(`❌ Error: Request number ${requestIdentifier} is out of range (1-${requestPaths.length})`);
      process.exit(1);
    }
    console.log(`🔍 Executing request #${requestIdentifier}: ${requestPath}`);
  } else {
    requestPath = requestIdentifier;
    console.log(`🔍 Executing request: ${requestPath}`);
  }
  
  try {
    const startTime = Date.now();
    const response = await client.request(requestPath);
    const totalTime = Date.now() - startTime;
    
    if (verbose) {
      // Verbose mode: show detailed information
      console.log("✅ Request completed successfully!");
      console.log("=".repeat(50));
      console.log(`📊 Status: ${response.status} ${response.statusText}`);
      console.log(`⏱️  Duration: ${response.duration}ms (total: ${totalTime}ms)`);
      console.log(`🌐 URL: ${response.url}`);
      console.log(`📤 Method: ${response.method}`);
      
      // Display request headers
      console.log("\n📤 Request Headers:");
      Object.entries(response.requestHeaders).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      // Display response headers
      console.log("\n📨 Response Headers:");
      Object.entries(response.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      // Display body
      console.log("\n📄 Response Body:");
    }
    
    // Always display the response body (untrimmed)
    if (response.json) {
      console.log(JSON.stringify(response.json, null, 2));
    } else {
      console.log(response.body);
    }
    
  } catch (error) {
    console.error(`❌ Request failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArguments(args);
  
  // Show help if requested or no arguments provided
  if (options.help || args.length === 0) {
    showHelp();
    process.exit(0);
  }
  
  // Validate required arguments
  if (!options.config && !options.interactive) {
    console.error("❌ Error: --config option is required (unless using --interactive mode)");
    console.error("Use --help for usage information");
    process.exit(1);
  }
  
  if (!options.request && !options.interactive && !options.list) {
    console.error("❌ Error: either 'request' command, 'list' command, or '--interactive' mode is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }
  
  try {
    // Handle interactive mode without config file
    if (options.interactive && !options.config) {
      // Import the standalone interactive CLI function
      const { startInteractiveCLI } = await import("./interactive");
      await startInteractiveCLI();
      return;
    }
    
    // Initialize cache driver
    const cacheDriver = options.cache 
      ? new FileCacheDriver(options.cache)
      : new InMemoryCacheDriver();
    
    // Initialize cookie driver
    const cookieDriver = options.cookie
      ? new FileCookieDriver(options.cookie)
      : new InMemoryCookieDriver();
    
    console.log("🚀 Initializing Insomnia CLI...");
    console.log(`📁 Config: ${options.config}`);
    if (options.env) console.log(`🔧 Environment: ${options.env}`);
    if (options.cookie) console.log(`🍪 Cookies: ${options.cookie}`);
    if (options.cache) console.log(`💾 Cache: ${options.cache}`);
    
    // Create and configure client
    const client = new InsomniaClient({
      config: options.config,
      env: options.env,
      cookieDriver,
      cacheDriver
    });
    
    console.log("✅ Configuration loaded successfully!\n");
    
    // Handle interactive mode with pre-configured client
    if (options.interactive) {
      await startInteractiveMode(client);
      return;
    }
    
    // Handle list command
    if (options.list) {
      listRequests(client);
      return;
    }
    
    // Handle special commands
    if (options.request === 'list') {
      listRequests(client);
      return;
    }
    
    // Execute the request
    await executeRequest(client, options.request!, options.verbose || false);
    
  } catch (error) {
    console.error(`❌ Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the CLI if this file is executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

export { main, parseArguments, showHelp };