# Agentica TypeScript SDK

[![npm version](https://img.shields.io/npm/v/@symbolica/agentica.svg)](https://www.npmjs.com/package/@symbolica/agentica)

[Agentica](https://agentica.symbolica.ai) is a type-safe AI framework that lets LLM agents integrate with your code—functions, classes, live objects, even entire SDKs. Instead of building MCP wrappers or brittle schemas, you pass references directly; the framework enforces your types at runtime, constrains return types, and manages agent lifecycle.

## Documentation

The full documentation can be found at [docs.symbolica.ai](https://docs.symbolica.ai).

## Installation

```sh
npm install @symbolica/agentica
```

## Quick Example

```typescript
import { agentic } from '@symbolica/agentica';

async function analyze(text: string): Promise<"positive" | "neutral" | "negative"> {
    return await agentic('Analyze sentiment', { text });
}

const result = await analyze("Type-constrained generation, in your codebase, is the future.");
```

See the [Quickstart Guide](https://docs.symbolica.ai/quickstart) for a complete walkthrough.

## Requirements

Node.js 20 or higher.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

See [LICENSE](./LICENSE).

