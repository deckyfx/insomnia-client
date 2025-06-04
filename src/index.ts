#!/usr/bin/env node
// CHANGELOG: [2025-06-05] - Added --auto/-a argument to automatically find first YAML file in current directory
// CHANGELOG: [2025-06-04] - Created CLI entry point for insomnia-cli with argument parsing and request execution
// CHANGELOG: [2025-06-04] - Made --config optional when using --interactive mode, allowing users to load config within interactive session
// CHANGELOG: [2025-06-04] - Added 'list' command to list all available request nodes alongside existing 'request list' syntax
// CHANGELOG: [2025-06-04] - Added request headers display in verbose mode to show both sent and received headers

import { InsomniaClient } from "./insomnia-client";
import { FileCacheDriver, InMemoryCacheDriver } from "./cache-drivers/index";
import { FileCookieDriver, InMemoryCookieDriver } from "./cookie-drivers/index";
import { startInteractiveMode } from "./interactive";
import { readdirSync } from "fs";
import { join } from "path";

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
  auto?: boolean;
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
 * Finds the first YAML file in the current working directory
 * @returns Path to the first YAML file found, or undefined if none found
 * @example
 * ```typescript
 * const yamlFile = findFirstYamlFile();
 * if (yamlFile) {
 *   console.log(`Found YAML file: ${yamlFile}`);
 * }
 * ```
 */
function findFirstYamlFile(): string | undefined {
  try {
    const cwd = process.cwd();
    const files = readdirSync(cwd);
    
    // Look for files with .yaml or .yml extensions
    const yamlFile = files.find(file => 
      file.toLowerCase().endsWith('.yaml') || file.toLowerCase().endsWith('.yml')
    );
    
    return yamlFile ? join(cwd, yamlFile) : undefined;
  } catch (error) {
    console.warn(`Warning: Could not read current directory: ${error}`);
    return undefined;
  }
}

/**
 * Finds the first .env file in the current working directory with priority logic
 * Priority: "env" > first found "*.env" file
 * @returns Path to the first .env file found, or undefined if none found
 * @example
 * ```typescript
 * const envFile = findFirstEnvFile();
 * if (envFile) {
 *   console.log(`Found .env file: ${envFile}`);
 * }
 * ```
 */
function findFirstEnvFile(): string | undefined {
  try {
    const cwd = process.cwd();
    const files = readdirSync(cwd);
    
    // Priority 1: Look for exact "env" file
    if (files.includes('env')) {
      return join(cwd, 'env');
    }
    
    // Priority 2: Look for files ending with .env
    const envFile = files.find(file => 
      file.toLowerCase().endsWith('.env')
    );
    
    return envFile ? join(cwd, envFile) : undefined;
  } catch (error) {
    console.warn(`Warning: Could not read current directory for .env files: ${error}`);
    return undefined;
  }
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
      case '--auto':
      case '-a':
        options.auto = true;
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
  --auto, -a           Automatically find and use first YAML and .env files in current directory
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

  # Auto-detect YAML and .env files in current directory
  bun index.ts --auto request "API/Auth/Login"

  # Auto-detect with explicit .env file (--env takes precedence)
  bun index.ts --auto --env custom.env request "API/Auth/Login"

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
  
  // Resolve config file: --config takes precedence over --auto
  let configPath: string | undefined = options.config;
  let envPath: string | undefined = options.env;
  
  if (!configPath && options.auto) {
    configPath = findFirstYamlFile();
    if (configPath) {
      console.log(`🔍 Auto-detected YAML file: ${configPath}`);
    } else {
      console.error("❌ Error: No YAML files found in current directory");
      console.error("Use --config to specify a configuration file or ensure a .yaml/.yml file exists in the current directory");
      process.exit(1);
    }
  }
  
  // Resolve env file: --env takes precedence over auto-detected .env
  if (!envPath && options.auto) {
    envPath = findFirstEnvFile();
    if (envPath) {
      console.log(`🔍 Auto-detected .env file: ${envPath}`);
    }
    // Note: .env is optional, so we don't error if none found
  }
  
  // Validate required arguments
  if (!configPath && !options.interactive) {
    console.error("❌ Error: --config option or --auto flag is required (unless using --interactive mode)");
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
    if (options.interactive && !configPath) {
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
    console.log(`📁 Config: ${configPath}`);
    if (envPath) console.log(`🔧 Environment: ${envPath}`);
    if (options.cookie) console.log(`🍪 Cookies: ${options.cookie}`);
    if (options.cache) console.log(`💾 Cache: ${options.cache}`);
    
    // Create and configure client
    const client = new InsomniaClient({
      config: configPath!,
      env: envPath,
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