# Insomnia CLI

A HTTP request testing tool that brings your Insomnia configurations to the command line. Execute API requests, chain responses, and test workflows directly from your terminal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)

## 🚀 Usage

### As Code

Import and use the Insomnia client programmatically in your TypeScript/JavaScript projects:

```typescript
import { InsomniaClient } from "insomnia-cli";

const client = new InsomniaClient();
// Load insomnia yaml
await client.loadConfig("path/to/insomnia-export.yaml");
// Figure out the requests can be made
await client.getRequestNodePaths();

// Execute a specific request
const response = await client.request("parsed request path or request ID");
```

### As Executable

Run requests directly from the command line:

```bash
# Execute a single request
bun run src/index.ts --config insomnia-export.yaml "parsed request path or request ID"
```

### As Interactive

Launch interactive mode to browse and execute requests:

```bash
# Start interactive mode
bun run src/index.ts --interactive
```

In interactive mode you can:

- Browse available requests and folders
- Select and execute requests with real-time feedback
- Chain multiple requests together
- Switch between environments
- View request/response details

---

### ✅ Currently Supported

- [x] **HTTP/HTTPS Requests** - Support for GET, POST, PUT, PATCH, DELETE, and other HTTP methods
- [x] **Environment Variables** - Parse and resolve `{{ _.variable_name }}` references from Insomnia environments
- [x] **Function Template** - Parse and resolve function template like: `{% ... %}` including request chaining
  - [x] Response
  - [x] Cookie
  - [x] Faker
  - [x] Prompt

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
