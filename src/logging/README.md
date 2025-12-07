# Logging and Telemetry

Hierarchical scoped logging with OpenTelemetry integration for the transformer.

## Quick Start

```bash
# Environment variable configuration
TS_LOG_LEVEL=debug npm run build
TS_LOG_LEVEL=info,traverser:debug npm run build
TS_LOG_LEVEL=silent,processor:site-2:debug npm run build
```

## Scope Hierarchy

Loggers inherit parent scopes:
- `createLogger("transformer")` → `[transformer]`
- `.withScope("file")` → `[transformer:file]`
- `.withScope("site-5")` → `[transformer:file:site-5]`

**Level resolution:** Most specific scope wins. `processor:site-2:debug` overrides `processor:info`.

## Configuration

**Environment variable:**
```bash
TS_LOG_LEVEL=<default>,<scope:level>,<scope:level>
```

**Programmatic:**
```typescript
import { globalConfig } from "./logging/config.js";

globalConfig.setDefaultLevel("info");
globalConfig.setScopeLevel("processor:site-2", "debug");
```

## Components

- **config.ts** - Scope level resolution and env parsing
- **logger.ts** - Consola-based logger with scope inheritance
- **span.ts** - OpenTelemetry span wrappers
- **types.ts** - Type definitions

## OpenTelemetry

**API-only by default.** Host applications can add SDK:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
    traceExporter: new ConsoleSpanExporter(),
});
sdk.start();
```

Spans and trace IDs automatically appear in logs when SDK is active.

## Depth Tracking

For indented nested logs:
```typescript
logger.incDepth();  // Increase indent
// ... nested work
logger.decDepth();  // Decrease indent
```


