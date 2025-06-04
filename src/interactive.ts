// CHANGELOG: [2025-06-04] - Created interactive CLI interface with continuous prompt loop and command parsing
// CHANGELOG: [2025-06-04] - Added support for numeric request selection based on list output
// CHANGELOG: [2025-06-04] - Added auto-loading of request paths after config/env loading
// CHANGELOG: [2025-06-04] - Added command history support with persistent file storage and arrow key navigation

import { appendFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { FileCookieDriver } from "./cookie-drivers";
import { FileCacheDriver } from "./cache-drivers";
import { InsomniaClient } from "./insomnia-client";

/**
 * Interactive CLI interface for Insomnia HTTP testing tool
 * Provides continuous prompt loop with command parsing and execution
 * @example
 * ```typescript
 * import { startInteractiveCLI } from './interactive';
 * startInteractiveCLI();
 * ```
 */

interface Command {
  name: string;
  args: string[];
}

// Store the last listed request paths for numeric reference
let lastRequestPaths: string[] = [];

// History file path
const HISTORY_FILE_PATH = join(process.cwd(), ".interactive.history");
const COOKIE_FILE_PATH = join(process.cwd(), ".interactive.cookie");
const CACHE_FILE_PATH = join(process.cwd(), ".interactive.cache");

/**
 * Loads command history from the persistent history file
 * @returns Array of command strings from history file
 */
function loadCommandHistory(): string[] {
  try {
    if (existsSync(HISTORY_FILE_PATH)) {
      const historyContent = readFileSync(HISTORY_FILE_PATH, "utf-8");
      return historyContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(-1000); // Keep last 1000 commands
    }
  } catch (error) {
    console.warn("Warning: Could not load command history:", error);
  }
  return [];
}

/**
 * Saves a command to the persistent history file
 * Only saves if command is different from the last command in history
 * @param command - Command string to save to history
 */
function saveCommandToHistory(command: string): void {
  try {
    const trimmedCommand = command.trim();
    if (trimmedCommand.length === 0) {
      return;
    }

    // Check if this command is the same as the last command in history
    const currentHistory = loadCommandHistory();
    const lastCommand = currentHistory[currentHistory.length - 1];

    if (lastCommand === trimmedCommand) {
      // Don't save duplicate consecutive commands
      return;
    }

    appendFileSync(HISTORY_FILE_PATH, trimmedCommand + "\n", "utf-8");
  } catch (error) {
    console.warn("Warning: Could not save command to history:", error);
  }
}

/**
 * Updates the internal request paths list from the client
 * This ensures numeric references are always available after loading config/env
 * @param client - Insomnia client instance
 */
function updateRequestPaths(client: InsomniaClient): void {
  try {
    const requestPaths = client.getRequestNodePaths();
    lastRequestPaths = requestPaths;

    if (requestPaths.length > 0) {
      console.log(
        `📋 Auto-loaded ${requestPaths.length} request node(s) for quick access`
      );
      console.log(
        "💡 Use 'request <number>' or 'list request-nodes' to see all available requests"
      );
    }
  } catch (error) {
    // Silently fail if config is not fully loaded yet
    lastRequestPaths = [];
  }
}

/**
 * Parses a command line input into command name and arguments
 * @param input - Raw command line input from user
 * @returns Parsed command object with name and arguments
 * @example
 * ```typescript
 * parseCommand("load config ./insomnia.yaml");
 * // Returns: { name: "load", args: ["config", "./insomnia.yaml"] }
 * ```
 */
function parseCommand(input: string): Command {
  // Trim whitespace and split on spaces, filtering out empty strings
  const parts = input
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  const name = parts[0] || "";
  const args = parts.slice(1);

  return { name, args };
}

/**
 * Displays help information for available commands
 */
function showHelp(): void {
  console.log(`
Available commands:
  load config <file>        - Load Insomnia YAML configuration file
  load env <file>           - Load environment variables from file
  list request-nodes        - List all available request node paths
  request [--verbose] <path|number> - Execute HTTP request for the specified node path or number
  help                      - Show this help message
  exit                      - Exit the interactive CLI

Examples:
  load config ./insomnia.yaml
  load env ./.env
  list request-nodes
  request API/Home/Get User
  request 1
  request --verbose 1       - Execute request with detailed debug output
  request 2 --verbose       - Verbose flag can be placed anywhere
`);
}

/**
 * Executes a parsed command using the Insomnia client
 * @param command - Parsed command object
 * @param client - Insomnia client instance
 * @returns Promise that resolves to true if command was valid and executed, false if invalid
 */
async function executeCommand(
  command: Command,
  client: InsomniaClient
): Promise<boolean> {
  try {
    switch (command.name.toLowerCase()) {
      case "load":
        if (command.args.length < 2) {
          console.log(
            "❌ Error: load command requires subcommand and file path"
          );
          console.log("Usage: load config <file> | load env <file>");
          return false;
        }

        const subCommand = command.args[0]?.toLowerCase();
        const filePath = command.args[1];

        if (!filePath) {
          console.log("❌ Error: file path is required");
          return false;
        }

        if (subCommand === "config") {
          console.log(`📁 Loading configuration from: ${filePath}`);
          client.loadConfig(filePath);
          console.log("✅ Configuration loaded successfully");
          // Auto-load request paths for quick numeric access
          updateRequestPaths(client);
        } else if (subCommand === "env") {
          console.log(`🌍 Loading environment variables from: ${filePath}`);
          client.loadEnv(filePath);
          console.log("✅ Environment variables loaded successfully");
          // Auto-load request paths in case config was already loaded and env affects resolution
          updateRequestPaths(client);
        } else {
          console.log(`❌ Error: unknown load subcommand "${subCommand}"`);
          console.log("Usage: load config <file> | load env <file>");
          return false;
        }
        break;

      case "list":
        if (command.args.length < 1) {
          console.log("❌ Error: list command requires a subcommand");
          console.log("Usage: list request-nodes");
          return false;
        }

        const listSubCommand = command.args[0]?.toLowerCase();
        if (listSubCommand === "request-nodes") {
          const requestPaths = client.getRequestNodePaths();

          if (requestPaths.length === 0) {
            console.log(
              "📭 No request nodes found. Load a configuration file first."
            );
            return false;
          }

          // Store the paths for numeric reference in request command
          lastRequestPaths = requestPaths;

          console.log(`📋 Found ${requestPaths.length} request node(s):`);
          requestPaths.forEach((path, index) => {
            console.log(`  ${index + 1}. ${path}`);
          });
          console.log(
            "\n💡 Tip: Use 'request <number>' to quickly execute a request by its number"
          );
        } else {
          console.log(`❌ Error: unknown list subcommand "${listSubCommand}"`);
          console.log("Usage: list request-nodes");
          return false;
        }
        break;

      case "request":
        if (command.args.length < 1) {
          console.log(
            "❌ Error: request command requires a node path or number"
          );
          console.log("Usage: request [--verbose] <request node path|number>");
          console.log("Examples: request API/Home/Get User");
          console.log("          request --verbose 1");
          console.log("          request 1 --verbose");
          return false;
        }

        // Check for --verbose flag
        const verboseIndex = command.args.indexOf("--verbose");
        const isVerbose = verboseIndex !== -1;

        // Remove --verbose flag from args for processing
        const filteredArgs = command.args.filter((arg) => arg !== "--verbose");

        if (filteredArgs.length === 0) {
          console.log(
            "❌ Error: request command requires a node path or number after flags"
          );
          console.log("Usage: request [--verbose] <request node path|number>");
          return false;
        }

        // Check if first argument (after removing flags) is a number
        const firstArg = filteredArgs[0];
        let requestPath: string;

        if (/^\d+$/.test(firstArg || "")) {
          // It's a number - look up in lastRequestPaths
          const index = parseInt(firstArg || "0", 10) - 1; // Convert to 0-based index

          if (lastRequestPaths.length === 0) {
            console.log(
              "❌ Error: No request list available. Use 'list request-nodes' first or load a config file."
            );
            return false;
          }

          if (index < 0 || index >= lastRequestPaths.length) {
            console.log(
              `❌ Error: Invalid number ${firstArg}. Valid range: 1-${lastRequestPaths.length}`
            );
            return false;
          }

          requestPath = lastRequestPaths[index] || "";
          console.log(
            `🔢 Executing request #${firstArg}: ${requestPath}${
              isVerbose ? " (verbose mode)" : ""
            }`
          );
        } else {
          // Join all arguments to handle paths with spaces
          requestPath = filteredArgs.join(" ");
          console.log(
            `🚀 Executing request: ${requestPath}${
              isVerbose ? " (verbose mode)" : ""
            }`
          );
        }

        if (isVerbose) {
          console.log(
            "🔍 Verbose mode enabled - showing detailed debug information"
          );

          // Show request node details before execution
          const requestNode = await client.getRequestNode(requestPath);
          if (requestNode) {
            console.log("📋 Request Details:");
            console.log(`  Name: ${requestNode.name}`);
            console.log(`  Method: ${requestNode.method}`);
            console.log(`  URL: ${requestNode.url}`);
            console.log(`  ID: ${requestNode.meta.id}`);

            if (requestNode.headers && requestNode.headers.length > 0) {
              console.log("  Headers:");
              requestNode.headers.forEach((header) => {
                if (header.name && header.value) {
                  const status = header.disabled ? " (disabled)" : "";
                  console.log(`    ${header.name}: ${header.value}${status}`);
                }
              });
            }

            if (requestNode.body) {
              console.log("  Body:");
              console.log(`    MIME Type: ${requestNode.body.mimeType}`);
              if (requestNode.body.text) {
                console.log(
                  `    Text: ${requestNode.body.text.substring(0, 200)}${
                    requestNode.body.text.length > 200 ? "..." : ""
                  }`
                );
              }
              if (
                requestNode.body.params &&
                requestNode.body.params.length > 0
              ) {
                console.log("    Form Parameters:");
                requestNode.body.params.forEach((param) => {
                  const status = param.disabled ? " (disabled)" : "";
                  console.log(`      ${param.name}: ${param.value}${status}`);
                });
              }
            }

            console.log("─".repeat(40));
          }
        }

        const startTime = Date.now();
        const response = await client.request(requestPath);
        const duration = Date.now() - startTime;

        console.log(`✅ Request completed in ${duration}ms`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`🌐 URL: ${response.url}`);
        console.log(`📝 Method: ${response.method}`);

        // Show response headers
        if (isVerbose) {
          // In verbose mode, show all headers
          console.log("📋 All Response Headers:");
          Object.entries(response.headers).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        } else {
          // In normal mode, show only important headers
          const importantHeaders = [
            "content-type",
            "content-length",
            "set-cookie",
          ];
          const responseHeaders = Object.entries(response.headers)
            .filter(([key]) => importantHeaders.includes(key.toLowerCase()))
            .slice(0, 5); // Limit to 5 headers max

          if (responseHeaders.length > 0) {
            console.log("📋 Headers:");
            responseHeaders.forEach(([key, value]) => {
              console.log(`  ${key}: ${value}`);
            });
          }
        }

        // Show response body
        if (response.body) {
          const maxBodyLength = isVerbose ? 5000 : 1000; // Show more in verbose mode
          const bodyPreview =
            response.body.length > maxBodyLength
              ? response.body.substring(0, maxBodyLength) +
                `... (truncated, ${response.body.length} total chars)`
              : response.body;

          console.log("📄 Response body:");
          console.log(bodyPreview);
        }

        // Show JSON if available
        if (response.json) {
          if (isVerbose) {
            console.log("🔧 Parsed JSON:");
            console.log(JSON.stringify(response.json, null, 2));
          } else {
            console.log(
              "🔧 Parsed JSON available (use --verbose to see full JSON)"
            );
          }
        }

        // Show timing information in verbose mode
        if (isVerbose) {
          console.log("⏱️ Timing Information:");
          console.log(`  Total Duration: ${duration}ms`);
          console.log(
            `  Response Size: ${response.body ? response.body.length : 0} bytes`
          );
          console.log(`  Success: ${response.ok}`);
        }
        break;

      case "help":
        showHelp();
        break;

      case "exit":
      case "quit":
        console.log("👋 Goodbye!");
        process.exit(0);
        break;

      case "":
        // Empty command, just continue
        return false; // Don't save empty commands to history
        
      default:
        console.log(`❌ Error: unknown command "${command.name}"`);
        console.log("Type 'help' for available commands");
        return false; // Don't save invalid commands to history
    }
    
    // If we reach here, the command was valid and executed successfully
    return true;
  } catch (error) {
    console.log(
      `❌ Error executing command: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // Don't save commands that caused errors to history
    return false;
  }
}

/**
 * Starts interactive mode with a pre-configured InsomniaClient
 * @param client - Pre-configured InsomniaClient instance
 */
export async function startInteractiveMode(client: InsomniaClient): Promise<void> {
  console.log("🚀 Insomnia CLI - Interactive Mode");
  console.log("Type 'help' for available commands or 'exit' to quit");
  console.log(`📝 Command history is saved to: ${HISTORY_FILE_PATH}`);
  console.log("─".repeat(50));

  // Load command history
  const commandHistory = loadCommandHistory();

  // Set up readline for user input with history support
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: commandHistory, // Load existing history
    historySize: 1000, // Keep last 1000 commands in memory
    removeHistoryDuplicates: true, // Remove duplicate commands
  });

  // Continuous prompt loop
  const prompt = () => {
    rl.question("insomnia> ", async (input: string) => {
      const trimmedInput = input.trim();

      const command = parseCommand(trimmedInput);
      const commandWasValid = await executeCommand(command, client);

      // Only save valid commands to history
      if (trimmedInput.length > 0 && commandWasValid) {
        saveCommandToHistory(trimmedInput);
      }

      // Continue the loop
      prompt();
    });
  };

  // Start the prompt loop
  prompt();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Goodbye!");
    rl.close();
    process.exit(0);
  });
}

/**
 * Starts the interactive CLI interface with continuous prompt loop
 * Initializes Insomnia client and handles user input until exit
 * @example
 * ```typescript
 * // Start the interactive CLI
 * startInteractiveCLI();
 * ```
 */
export async function startInteractiveCLI(): Promise<void> {
  // Initialize Insomnia client
  const client = new InsomniaClient();

  client.setCookieDriver(new FileCookieDriver(COOKIE_FILE_PATH));
  client.setCacheDriver(new FileCacheDriver(CACHE_FILE_PATH));

  console.log("🚀 Insomnia CLI - Interactive Mode");
  console.log("Type 'help' for available commands or 'exit' to quit");
  console.log(`📝 Command history is saved to: ${HISTORY_FILE_PATH}`);
  console.log("─".repeat(50));

  // Load command history
  const commandHistory = loadCommandHistory();

  // Set up readline for user input with history support
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: commandHistory, // Load existing history
    historySize: 1000, // Keep last 1000 commands in memory
    removeHistoryDuplicates: true, // Remove duplicate commands
  });

  // Continuous prompt loop
  const prompt = () => {
    rl.question("insomnia> ", async (input: string) => {
      const trimmedInput = input.trim();

      const command = parseCommand(trimmedInput);
      const commandWasValid = await executeCommand(command, client);

      // Only save valid commands to history
      if (trimmedInput.length > 0 && commandWasValid) {
        saveCommandToHistory(trimmedInput);
      }

      // Continue the loop
      prompt();
    });
  };

  // Start the prompt loop
  prompt();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Goodbye!");
    rl.close();
    process.exit(0);
  });
}
