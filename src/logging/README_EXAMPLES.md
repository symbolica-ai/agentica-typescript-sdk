# Logging System Usage Guide

## Quick Start

### Basic Logger Creation and Usage

```typescript
import { createLogger } from "../logging/index.js";

const logger = createLogger("myComponent");

logger.debug("Detailed debug information");
logger.info("General information");
logger.warn("Warning message");
logger.error("Error occurred", error);
```

### Hierarchical Scopes

Create child loggers for different subsystems:

```typescript
const transformerLogger = createLogger("transformer");
const processorLogger = transformerLogger.withScope("processor");
const siteLogger = processorLogger.withScope(`site-${siteId}`);

transformerLogger.info("Processing started");
// Output: [transformer] ℹ Processing started

processorLogger.info("Generating context");
// Output: [processor] ℹ Generating context

siteLogger.debug("Traversing types");
// Output: [processor:site-0] 🐛 Traversing types
```

### Depth Tracking for Nested Operations

```typescript
const logger = createLogger("traverser");

logger.info("Starting type traversal");
// Output: [traverser] ℹ Starting type traversal

const nestedLogger = logger.withDepth(1);
nestedLogger.debug("Processing complex type");
// Output: [traverser]    Processing complex type (indented)

const deepLogger = nestedLogger.withDepth(1);
deepLogger.debug("Processing nested property");
// Output: [traverser]        Processing nested property (more indented)
```

## OpenTelemetry Integration

### Creating and Managing Spans

```typescript
import { createLogger } from "../logging/index.js";

const logger = createLogger("transformer");
const span = logger.startSpan("magicFunTransformer");

try {
    // Set attributes for telemetry
    span.setAttribute("magic_sites_count", magicSites.length);
    span.setAttribute("files_with_exports", fileToExportSpecs.size);
    
    // Do work - logs will include trace/span IDs
    logger.info("Processing magic sites");
    // Output: [transformer] ℹ Processing magic sites [trace=a1b2c3d4 span=e5f6g7h8]
    
    // More work...
} catch (error) {
    // Record exception in span
    span.recordException(error);
    logger.error("Transformation failed", error);
    throw error;
} finally {
    // Always end the span
    span.end();
}
```

### Nested Spans

```typescript
const logger = createLogger("processor");
const outerSpan = logger.startSpan("generateContext");

try {
    outerSpan.setAttribute("site_id", site.id);
    
    // Nested operation
    const innerSpan = logger.startSpan("processTargets");
    try {
        innerSpan.setAttribute("target_count", targets.length);
        // Process targets
    } finally {
        innerSpan.end();
    }
    
} finally {
    outerSpan.end();
}
```

## Runtime Configuration

### Environment Variable

Set log levels via `TS_LOG_LEVEL`:

```bash
# Set default level
TS_LOG_LEVEL=debug npm run build

# Set default with scope overrides (comma-separated)
TS_LOG_LEVEL=info,traverser:debug,encoder:warn npm run build

# Silence all logging
TS_LOG_LEVEL=silent npm run build

# Debug specific site
TS_LOG_LEVEL=info,processor:site-5:debug npm run build
```

### Programmatic Configuration

```typescript
import { setDefaultLogLevel, setLogLevel } from "../logging/index.js";

// Set default level for all loggers
setDefaultLogLevel("info");

// Override for specific scopes
setLogLevel("transformer", "debug");
setLogLevel("processor", "info");
setLogLevel("traverser", "warn");

// Hierarchical scopes work too
setLogLevel("processor:site-5", "debug"); // Only debug site-5

// Access global config directly
import { loggingConfig } from "../logging/index.js";

// Configure at runtime
loggingConfig.setDefaultLevel("info");
loggingConfig.setScopeLevel("traverser", "debug");

// Check effective level (with scope hierarchy)
const effectiveLevel = loggingConfig.getEffectiveLevel("processor:site-0");
// Returns most specific level: site-0 > processor > default

// Check if logging is enabled for a specific level
const shouldLog = loggingConfig.shouldLog("traverser", "debug");
```

## Best Practices

### 1. Create Loggers at Module Level

```typescript
// Good: Create once per module
const logger = createLogger("myModule");

export function myFunction() {
    logger.info("Doing work");
}
```

### 2. Use Scopes for Subsystems

```typescript
// Good: Hierarchical organization
const logger = createLogger("transformer");
const fileLogger = logger.withScope("file");
const siteLogger = logger.withScope(`site-${id}`);
```

### 3. Always End Spans

```typescript
// Good: Use try-finally
const span = logger.startSpan("operation");
try {
    // Work
} finally {
    span.end(); // Always called
}
```

### 4. Add Context to Spans

```typescript
const span = logger.startSpan("processFile");
span.setAttribute("file_name", fileName);
span.setAttribute("file_size", fileSize);
span.setAttribute("magic_sites", siteCount);
```
