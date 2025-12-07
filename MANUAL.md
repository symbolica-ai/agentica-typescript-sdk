# Agentica

Asynchronous cross-machine runtime for agentic remote execution.

## Key components

### Transformer
Compile-time type information materialization
- Scans for targets that need type analysis
- Walks types via the TS compiler API
- Manages exports
- Injects a context object containing type info

### Message protocol
RPC protocol for the core object model and dynamic execution requests
- See the specification in [Notion](https://www.notion.so/symbolica/WarpC-TS-specification-26422cac959e80c8bce1fef9e9381aea)

### Context manager
Manages local and remote runtime context
- Context-dependent encoding and decoding of runtime variables (per frame)
- Virtual resource creation

### Frame runtime
Keeps track of a tree of frames (tracking nested/parallel requests)
- Each local frame can open multiple concurrent remote child frames
- See the frame model in [Notion](https://www.notion.so/symbolica/Warpc-Frame-Model-26822cac959e80359994d8309cd8a68e)

### Session manager
Provides a global manager of connections per invocation per magic function.

### Agentica Client
Client for managing sandbox lifecycle and session management.
- **Environment cases**: Automatically detects production vs development mode
- **Sandbox management**: Handles sandbox creation, keepalive, and cleanup
- **API key authentication**: Bearer token authentication for platform service

## Usage

### Environment Variables

**Production Mode:**
```bash
AGENTICA_API_KEY=your_api_key
AGENTICA_BASE_URL=https://api.agentica.symbolica.ai  # optional, defaults to this
```

**Development Mode:**
```bash
S_M_BASE_URL=http://localhost:2345
```

**Bundler Support:**
The Agentica library automatically handles environment variables across all bundlers:
- **Node.js / Next.js / Webpack / Rollup / esbuild**: Uses `process.env.VAR` directly
- **Vite**: Uses `import.meta.env.VITE_VAR` for client-side code

No additional bundler configuration is required for environment variable access.

### Agentica Client Usage

```typescript
import { Agentica, getGlobalCsm } from '@symbolica/agentica';

// Direct usage
const client = new Agentica('https://api.agentica.symbolica.ai', 'your_api_key');
const csm = await client.getSessionManager();

// Global session manager (environment-aware)
const globalCsm = await getGlobalCsm();
```

### Magic Functions

```typescript
import { magic, magicPro, spawn, Agent } from '@symbolica/agentica';

// Basic magic call with prompt and scope
const result = await magic<number>("Count words in the text", { text: "Hello world" });

// Magic with tagged template literal (Pro version)
const x = 5;
const result2 = await magicPro<number>`Explain how to calculate ${x} * 2`();

// Persistent agent
const agent: Agent = await spawn({ premise: "You are a helpful assistant" }, { tools: theTools });
const count = await agent.call<number>("Add 2 to the value", { value: 3 });

// Agent with tagged template literal (Pro version)
const a = 3;
const count2 = await agent.callPro<number>`Calculate ${a} + 7`();
```

### Streaming

Both magic functions and agents support streaming via the `listener` callback:

```typescript
// Streaming magic function
const x = 5;
const result = await magic<number>(
    "Explain how to calculate x * 2 and return the result",
    { x },
    { 
        listener: (iid, chunk) => {
            process.stdout.write(chunk.content);
        }
    }
);
// result is directly the final value

// Streaming with magicPro
const result2 = await magicPro<number>`Calculate ${x} * 2`({
    listener: (iid, chunk) => {
        process.stdout.write(chunk.content);
    }
});

// Streaming agent calls - listener at spawn level
const agent = await spawn({ 
    premise: "You are a helpful assistant",
    listener: (iid, chunk) => {
        console.log(chunk.content);
    },
});

// Or listener at call level
const a = 3;
const result3 = await agent.call<number>("Calculate a + 7", { a }, {
    listener: (iid, chunk) => {
        console.log(chunk.content);
    }
});

// Or with callPro
const result4 = await agent.callPro<number>`Calculate ${a} + 7`({
    listener: (iid, chunk) => {
        console.log(chunk.content);
    }
});
```

### Resource Management

* `await using`
* `agent.close()`
* Automatic GC (sends warning about preferring the above methods) ... slow!

## Integration with Build Tools

Agentica provides clean, standards-compliant plugins for all major build tools.

### Automated Setup

The easiest way to set up Agentica in your project:

```bash
npx agentica-setup
```

This will automatically detect your build tool (Vite, Webpack, Rollup, esbuild, Next.js, or TypeScript CLI) and configure it appropriately.

### Manual Configuration

**Vite:**
```typescript
import agentica from '@symbolica/agentica/vite';

export default defineConfig({
  plugins: [agentica(), react()]
});
```

**Webpack:**
```javascript
import agentica from '@symbolica/agentica/webpack';

module.exports = {
  plugins: [agentica()]
};
```

**Rollup:**
```javascript
import agentica from '@symbolica/agentica/rollup';

export default {
  plugins: [agentica()]
};
```

**esbuild:**
```javascript
import agentica from '@symbolica/agentica/esbuild';

require('esbuild').build({
  plugins: [agentica()]
});
```

**Next.js:**
```typescript
import { withAgentica } from '@symbolica/agentica/next';

export default withAgentica(nextConfig);
```

All plugins support optional configuration for debug logging and TypeScript compiler options.

See [INSTALL.md](./INSTALL.md) for detailed setup instructions.

## Build project

Prereqs: Node >=20, then install deps once:
```bash
npm install
```

Build all (transformer + library):
```bash
npm run build:all
```
This compiles the transformer with `tsconfig.transformer.json` → `dist-transformer/`, then builds the library with ts-patch using `tsconfig.json` → `dist/`.

