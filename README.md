# Insomnia CLI

A powerful HTTP request testing tool that brings your Insomnia configurations to the command line. Execute API requests, chain responses, and test workflows directly from your terminal with full Insomnia compatibility.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)

## 🚀 Features

### 🎯 Core Functionality
- **Full Insomnia Compatibility**: Import and execute Insomnia YAML configurations without modification
- **Request Chaining**: Advanced `{% response %}` template support with automatic pre-request execution
- **Environment Variables**: Dynamic template resolution with `.env` file support
- **Authentication**: Automatic inheritance from parent folders with multiple auth types
- **Cookie Management**: Persistent cookie storage with automatic handling

### 🔧 Advanced Capabilities
- **Response Caching**: Intelligent caching system to avoid redundant API calls
- **Base64 Decoding**: Automatic handling of `b64::...::46b` encoded JSON paths
- **Template Processing**: Full support for Insomnia's template syntax and variables
- **Request Dependencies**: Automatic execution of dependent requests for chained workflows
- **Circular Detection**: Prevents infinite loops in request dependencies

### 🖥️ CLI Interface
- **Single Request Mode**: Execute individual requests by path or number
- **Interactive Mode**: Continuous session with command history and navigation
- **Verbose Output**: Detailed request/response information with headers and timing
- **List Mode**: View all available requests in your configuration
- **Flexible Storage**: Choose between in-memory or persistent file-based storage

## 📦 Installation

### Method 1: NPX (Recommended)
No installation required! Use npx to run the CLI directly:

```bash
# Run directly with npx
npx @insomnia-cli/core --help

# Execute a request
npx @insomnia-cli/core --config insomnia.yaml request "API/Auth/Login"

# Interactive mode
npx @insomnia-cli/core --config insomnia.yaml --interactive
```

### Method 2: Global Installation
```bash
# Install globally
npm install -g @insomnia-cli/core

# Use directly
insomnia-cli --config insomnia.yaml request "API/Auth/Login"
```

### Method 3: Development Setup
For contributing or local development:

#### Prerequisites
- [Node.js](https://nodejs.org) v18.0.0 or later
- [Bun](https://bun.sh) runtime (v1.2.15 or later) for development

#### Setup
```bash
# Clone the repository
git clone https://github.com/your-username/insomnia-cli.git
cd insomnia-cli

# Install dependencies
bun install

# Build the project
bun run build

# Run locally
node dist/index.js --help
```

## 🎯 Quick Start

### 1. Export Your Insomnia Collection
In Insomnia, go to **Application** → **Preferences** → **Data** → **Export Data** and choose YAML format.

### 2. Basic Usage
```bash
# Execute a specific request
npx @insomnia-cli/core --config insomnia.yaml request "API/Auth/Login"

# List all available requests
npx @insomnia-cli/core --config insomnia.yaml request list

# Interactive mode
npx @insomnia-cli/core --config insomnia.yaml --interactive
```

## 📚 Usage Guide

### Command Line Options

| Option | Short | Description |
|--------|--------|-------------|
| `--config <file>` | | Path to Insomnia YAML configuration (required) |
| `--env <file>` | | Path to environment variables file |
| `--cookie <file>` | | Path to persistent cookie storage |
| `--cache <file>` | | Path to cache directory |
| `--interactive` | `-i` | Enter interactive mode |
| `--verbose` | `-v` | Show detailed output |
| `--help` | `-h` | Show help information |

### Examples

#### Basic Request Execution
```bash
# Execute by request path
npx @insomnia-cli/core --config api.yaml request "Users/GetProfile"

# Execute by number (after listing)
npx @insomnia-cli/core --config api.yaml request 1

# With environment variables
npx @insomnia-cli/core --config api.yaml --env .env request "Auth/Login"
```

#### Persistent Storage
```bash
# Use file-based cookie and cache storage
npx @insomnia-cli/core --config api.yaml \
  --cookie cookies.json \
  --cache .cache \
  request "API/Users/GetProfile"
```

#### Verbose Output
```bash
# Show detailed request/response information
npx @insomnia-cli/core --config api.yaml --verbose request "API/Auth/Login"
```

#### Interactive Mode
```bash
# Start interactive session
npx @insomnia-cli/core --config api.yaml --interactive

# Interactive commands:
insomnia> list request-nodes
insomnia> request 1
insomnia> request --verbose "API/Users/GetProfile"
insomnia> exit
```

### Request Chaining Example

Insomnia CLI fully supports request chaining with `{% response %}` templates:

```yaml
# In your Insomnia YAML config
requests:
  - name: "Get Auth Token"
    id: "req_auth_001"
    url: "https://api.example.com/auth/login"
    method: "POST"
    
  - name: "Get User Profile"
    url: "https://api.example.com/user/profile"
    method: "GET"
    headers:
      - name: "Authorization"
        value: "Bearer {% response 'body', 'req_auth_001', 'b64::JC5hY2Nlc3NfdG9rZW4=::46b', 'when-expired', 3600 %}"
```

The CLI will:
1. Execute the auth request first
2. Extract the access token from the response body using the base64-decoded JSON path (`$.access_token`)
3. Cache the result for 1 hour
4. Use the token in the Authorization header for subsequent requests

## 🔧 Configuration

### Environment Variables
Create a `.env` file to define variables used in your Insomnia templates:

```env
API_BASE_URL=https://api.example.com
API_KEY=your-api-key-here
USER_ID=12345
```

Reference in Insomnia templates:
```yaml
url: "{{ _.API_BASE_URL }}/users/{{ _.USER_ID }}"
headers:
  - name: "X-API-Key"
    value: "{{ _.API_KEY }}"
```

### Cookie Storage
- **In-Memory**: Default, cookies lost after session
- **File-Based**: Persistent across sessions when `--cookie <file>` specified

### Cache Storage
- **In-Memory**: Default, cache lost after session  
- **File-Based**: Persistent across sessions when `--cache <file>` specified

## 🏗️ Project Structure

```
insomnia-cli/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── insomnia-client.ts       # Core HTTP client
│   ├── interactive.ts           # Interactive mode interface
│   ├── cache-drivers/           # Caching implementations
│   ├── cookie-drivers/          # Cookie management
│   ├── utils/                   # Utilities and parsers
│   └── @types/                  # TypeScript type definitions
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Development

### TypeScript Compilation
```bash
# Type checking
bun run typecheck

# Hot reload development
bun run dev
```

### Build
```bash
# Build for distribution
bun run build
```

### Testing
```bash
# Run with sample config (development)
bun src/index.ts --config examples/sample.yaml request list

# Test built version
node dist/index.js --config examples/sample.yaml request list
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure TypeScript compilation passes: `bun run typecheck`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](#license) file for details.

## 🙏 Acknowledgments

- [Insomnia](https://insomnia.rest/) for the excellent API client and configuration format
- [Bun](https://bun.sh) for the fast JavaScript runtime and toolkit
- The open-source community for inspiration and tools

---

## License

```
MIT License

Copyright (c) 2025 Insomnia CLI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
