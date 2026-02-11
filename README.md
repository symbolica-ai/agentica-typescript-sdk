![Header image](assets/Header.png)

# Agentica TypeScript SDK

[![npm version](https://img.shields.io/npm/v/@symbolica/agentica.svg)](https://www.npmjs.com/package/@symbolica/agentica)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1470799122717085941?logo=discord&label=Discord)](https://discord.gg/bddGs8bb)
[![Twitter](https://img.shields.io/twitter/follow/symbolica?style=flat&logo=x&label=Follow)](https://x.com/symbolica)

[Agentica](https://agentica.symbolica.ai) is a type-safe AI framework that lets LLM agents integrate with your code—functions, classes, live objects, even entire SDKs. Instead of building MCP wrappers or brittle schemas, you pass references directly; the framework enforces your types at runtime, constrains return types, and manages agent lifecycle.

## Documentation

The full documentation can be found at [docs.symbolica.ai](https://docs.symbolica.ai).

## Installation

```sh
npm install @symbolica/agentica
```

Grab an API key [here](https://www.symbolica.ai/agentica).

**Want to run locally?** Run the [Agentica Server](https://github.com/symbolica-ai/agentica-server).

## Quick Example

```typescript
import { agentic } from '@symbolica/agentica';

async function analyze(text: string): Promise<"positive" | "neutral" | "negative"> {
    return await agentic('Analyze sentiment', { text });
}

const result = await analyze("Agentica is an amazing framework!");
```

See the [Quickstart Guide](https://docs.symbolica.ai/quickstart) for a complete walkthrough.

## Requirements

Node.js 20 or higher.

## Acknowledgements

Agentica uses a TypeScript transformer to transfer typing information from compile time to runtime. The associated bundler/build plugin was derived from the [unplugin-typia](https://github.com/ryoppippi/unplugin-typia) implementation. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for more information.

## Issues

Please report bugs, feature requests, and other issues in the [symbolica/agentica-issues](https://github.com/symbolica-ai/agentica-issues) repository.

## License

This project is licensed under the [MIT License](./LICENSE).

