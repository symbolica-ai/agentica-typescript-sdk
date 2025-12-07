[[DELETE THIS]]

# Packaging and Installation Guide

This guide covers how Agentica is packaged, installed, and integrated into TypeScript projects.

**You should use a Markdown viewer to view this document.**


---

## Phase 0: Package Distribution

**Developer workflow:**

```
1. Write code in: customer_sdk/typescript/
2. Package: npm run pack (runs build:all + pack)
   - Compiles TypeScript → dist/ and dist-transformer/
   - Creates tarball: symbolica-agentica-0.0.68.tgz
3. Publish:
   - npm publish → https://registry.npmjs.org/@symbolica/agentica
   OR
   - Keep local tarball for testing
```

**Tarball contents:**

```bash
symbolica-agentica-0.0.68.tgz
├── package.json              # Metadata, dependencies, exports
├── dist/                     # Compiled runtime code
│   ├── index.js             # Main entry (magic, spawn, etc.)
│   ├── nextjs-wrapper.js    # withAgentica() for Next.js
│   ├── agentica-unplugin.js     # Universal plugin adapter
│   ├── bin/agentica-setup.js    # CLI setup tool
│   └── ...
├── dist-transformer/         # Transformer code (type analysis)
└── src/                      # Source (for sourcemaps)
```

---

## Phase 1: User Installs Package

**Installation:**

```bash
# From npm registry (published)
npm install @symbolica/agentica

# From local tarball (testing)
npm install /path/to/symbolica-agentica-0.0.68.tgz
```

**What `npm install` does:**

1. **Reads tarball's `package.json`** (not user's):
   - Name, version, dependencies
   - `"bin"` field → registers CLI commands
   - `"exports"` field → defines module entry points

2. **Extracts to:** `node_modules/@symbolica/agentica/`

3. **Creates CLI symlink:**
   ```bash
   node_modules/.bin/agentica-setup → node_modules/@symbolica/agentica/dist/bin/agentica-setup.js
   ```

4. **Installs dependencies:** unplugin, typescript, etc.

5. **Updates user's `package.json`:**
   ```json
   {
     "dependencies": {
       "@symbolica/agentica": "^0.0.68"
     }
   }
   ```

6. **Updates `package-lock.json`** with exact versions

---

## Phase 2: Setup - Configure Build Tool

Run the setup script:

```bash
npx agentica-setup
```

**What `npx` does:**
1. Looks for binary in `node_modules/.bin/agentica-setup`
2. Executes: `node node_modules/.bin/agentica-setup`

**What `agentica-setup` does:**

| Step | Next.js | React + Vite | Node.js / Plain TypeScript |
|------|---------|--------------|----------------------------|
| **1. Detect** | Finds `next.config.*` | Finds `vite.config.*` | Finds `tsconfig.json` only |
| **2. Read config** | `next.config.ts` | `vite.config.ts` | Creates/modifies `tsconfig.json` |
| **3. Inject plugin** | Add `withAgentica()` wrapper | Add `agenticaPlugin()` to plugins | Add transformer to `tsconfig.json` plugins |
| **4. Install deps** | `npm install` | `npm install` | `npm install` + `npx ts-patch install` |

### **Config File Changes**

<table>
<tr>
<th>Next.js</th>
<th>React + Vite</th>
<th>Plain TypeScript</th>
</tr>
<tr>
<td>

**Before:**
```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

**After:**
```typescript
import { withAgentica } from '@symbolica/agentica/next';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withAgentica(nextConfig);
```

</td>
<td>

**Before:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**After:**
```typescript
import agentica from '@symbolica/agentica/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [agentica(), react()],
});
```

</td>
<td>

**tsconfig.json modified:**
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@symbolica/agentica/transformer"
      }
    ]
  }
}
```

**package.json modified:**
```json
{
  "devDependencies": {
    "ts-patch": "^3.3.0"
  },
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
```

</td>
</tr>
</table>

---

## Phase 3: Build - Code Transformation

Run your build command:

```bash
npm run build  # or npm run dev
```

### Build Pipeline Comparison

| Stage | Next.js (Webpack) | React + Vite (esbuild) | TypeScript CLI (tsc) |
|-------|-------------------|------------------------|----------------------|
| **Entry** | `next build` | `vite build` | `tsc` or `ts-node` |
| **Config loading** | Loads `next.config.ts`<br/>Calls `withAgentica()` | Loads `vite.config.ts`<br/>Loads `agenticaPlugin()` | Uses `ts-patch` to load transformer |
| **Bundler** | Webpack | Vite (uses esbuild) | None (plain tsc) |
| **Plugin integration** | `config.plugins.unshift(unpluginAgentica.webpack())` | `plugins: [agenticaPlugin()]` | TypeScript compiler plugin API |
| **Transform timing** | `enforce: 'pre'` (before SWC) | Before esbuild | During TypeScript compilation |
| **Output** | `.next/server/` and `.next/static/` | `dist/` | Output per tsconfig `outDir` |

### Transformation Flow (Common Across All)

For each `.ts`/`.tsx` file:

```
1. Load file content
   ↓
2. Check: transformInclude(filename)
   → Returns true for .ts/.tsx files
   ↓
3. transform(code, filename)
   ↓
   a. Create TypeScript Program (with full type info)
   b. Resolve imports from node_modules/
   c. Include type definitions from node_modules/@types/
   d. Call: magicFunTransformer(program)
      ↓
      1. Scan for magic(), spawn(), agent.call()
      2. Extract type info using TypeScript compiler
      3. Traverse function/class definitions
      4. Generate context object
      5. Replace magic() → magicTransformation(__CONTEXT__, ...)
   ↓
   e. Return transformed code
   ↓
4. Pass to next stage (SWC/esbuild/output)
```

### Code Transformation Example

**Before transformation:**
```typescript
export async function GET() {
  const result = await magic<number>("Return 42");
  return Response.json(result);
}
```

**After transformation:**
```typescript
export async function GET() {
  const result = await (async () => {
    const __MAGIC_CONTEXT__ = {
      concepts: { /* serialized type info */ },
      siteId: "0",
      siteOutputType: "number",
      docString: "..."
    };
    return magicTransformation(__MAGIC_CONTEXT__, "Return 42");
  })();
  return Response.json(result);
}
```

---

## Phase 4: Run Application

| Framework | Dev Mode | Production Mode |
|-----------|----------|-----------------|
| **Next.js** | `npm run dev`<br/>• Watches files<br/>• Rebuilds on save<br/>• HMR enabled | `npm run build` + `npm run start`<br/>• Uses pre-built `.next/`<br/>• No compilation |
| **React + Vite** | `npm run dev`<br/>• Instant HMR<br/>• No bundling (ESM) | `npm run build` + serve `dist/`<br/>• Optimized bundle |
| **Node.js** | `ts-node src/index.ts`<br/>or `tsx src/index.ts` | `tsc` + `node dist/index.js` |

---

## Phase 5: Runtime Execution Examples

### Runtime Flow (Server-Side)

**Example: Next.js API route**

```
1. User visits: http://localhost:3000/api/test
   ↓
2. Next.js routes to: .next/server/app/api/test/route.js
   ↓
3. Executes GET() function:
   
   export async function GET() {
     const meaning = await (async () => {
       const __MAGIC_CONTEXT__ = { /* generated at build time */ };
       return magicTransformation(__MAGIC_CONTEXT__, "Return 42");
     })();
     return Response.json(meaning);
   }
   ↓
4. magicTransformation() executes:
   - Connects to session manager (e.g., http://localhost:2345 or api.symbolica.com)
   - Sends concept context (functions, classes, types)
   - Session manager invokes LLM
   - LLM may call back into your code (RPC)
   - Returns: 42
   ↓
5. Returns: Response.json(42)
   ↓
6. User receives: 42
```

### Runtime Flow (Browser-Side)

**Example: React component**

```
1. User interacts with UI (e.g., clicks button)
   ↓
2. React component executes:
   
   function MyComponent() {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     
     async function drawShape(x: number, y: number, color: string) {
       const ctx = canvasRef.current?.getContext('2d');
       ctx.fillStyle = color;
       ctx.arc(x, y, 50, 0, Math.PI * 2);
       ctx.fill();
     }
     
     const handleClick = async () => {
       const result = await (async () => {
         const __MAGIC_CONTEXT__ = { /* generated at build time */ };
         return magicTransformation(__MAGIC_CONTEXT__, 
           "Draw a blue circle in the center", 
           { drawShape, canvas: canvasRef.current }
         );
       })();
     };
   }
   ↓
3. magicTransformation() executes:
   - Opens WebSocket to session manager (api.symbolica.com)
   - Sends concept context (drawShape function, canvas reference)
   - Session manager invokes LLM
   ↓
4. LLM generates plan:
   - "I'll call drawShape(250, 250, 'blue')"
   ↓
5. Session manager sends RPC call back over WebSocket:
   - Invoke: drawShape(250, 250, 'blue')
   ↓
6. Browser executes drawShape():
   - Gets canvas context
   - Draws blue circle at coordinates
   - Returns: void
   ↓
7. Session manager receives response
   ↓
8. LLM completes, returns result
   ↓
9. User sees: Blue circle drawn on canvas
```

### What can `magic` do

| Environment | Can Use `magic()`? | Available Resources |
|-------------|-------------------|---------------------|
| **Next.js API routes** | ✅ Yes | Server-side: API keys, databases, file system, Node.js libraries |
| **Next.js Server Components** | ✅ Yes | Server-side: Same as API routes |
| **React client components** | ✅ Yes | Browser: DOM, localStorage, IndexedDB, File API, Canvas, WebGL |
| **Node.js scripts** | ✅ Yes | Server-side: Full Node.js environment |
| **Vite SSR** | ✅ Yes | Server-side during render, browser after hydration |
---

## Key Packaging Concepts

### Using `exports` Field

When `package.json` has:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./next": "./dist/nextjs-wrapper.js",
    "./vite": "./dist/agentica-unplugin.js",
    "./transformer": "./dist-transformer/index.js"
  }
}
```

You can import:

```typescript
import { magic } from '@symbolica/agentica';           // → dist/index.js
import { withAgentica } from '@symbolica/agentica/next';   // → dist/nextjs-wrapper.js
import agentica from '@symbolica/agentica/vite';     // → dist/agentica-unplugin.js
```

**Node.js resolution:**
```
1. Looks in: node_modules/@symbolica/agentica/
2. Checks exports in package.json
3. Maps import path to file path
4. Loads the target file
```

### Using `bin` Field

When `package.json` has:

```json
{
  "bin": {
    "agentica-setup": "dist/bin/agentica-setup.js"
  }
}
```

**`npm install` creates symlink:**
```bash
node_modules/.bin/agentica-setup → node_modules/@symbolica/agentica/dist/bin/agentica-setup.js
```

**`npx` automatically finds and runs it:**
```bash
npx agentica-setup  # Runs the symlinked script
```

### The Idea of Bundlers

A **bundler** takes your source code and:
- Resolves all import/require statements
- Combines files into bundles
- Transforms modern JS → browser-compatible JS
- Handles non-JS assets (CSS, images, etc.)

Common bundlers:
- **Webpack** (most configurable, complex)
- **Vite** (fast, modern)
- **Rollup** (library-focused)
- **esbuild** (extremely fast, Go-based)

### Bundler Plugin Imports

Agentica follows standard unplugin conventions with clean default exports for each bundler:

**Vite:**
```typescript
import agentica from '@symbolica/agentica/vite';

export default defineConfig({
  plugins: [agentica(), react()]
});
```

**Webpack:**
```javascript
const agentica = require('@symbolica/agentica/webpack');
// or
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

**Next.js** (uses a wrapper pattern):
```typescript
import { withAgentica } from '@symbolica/agentica/next';

const nextConfig = {
  // your config
};

export default withAgentica(nextConfig);
```

All plugins support optional configuration:
```typescript
import agentica from '@symbolica/agentica/vite';

export default defineConfig({
  plugins: [
    agentica({
      debug: true,  // Enable debug logging
      compilerOptions: {
        // TypeScript compiler options override
      }
    }),
    react()
  ]
});
```

---
