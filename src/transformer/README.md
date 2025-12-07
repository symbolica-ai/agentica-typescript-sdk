# Magic Function Transformation

Compile-time transformation that materializes TypeScript type information for runtime RPC.

## Workflow of the transformation

### 1. Collect magic call sites (`processor/processor.ts`)
- Scan all source files for `magic()`, `spawn()`, and `agent.call()` calls
- Extract: call site, enclosing function, docstring, site type
- Skip declaration files

### 2. Traverse types (`traverser/`)

**Scope argument extraction:**
- **Pro calls** (tagged templates): `magicPro\`text ${obj}\`()` or `agent.callPro\`text ${obj}\`()` → extract from template substitutions
- **Regular calls**: `magic("prompt", {scope})`, `agent.call("prompt", {scope})`, `spawn(config, {scope})` → extract from second argument
- For each scope entry: extract accessor path (e.g., `foo.bar` → `["foo", "bar"]`)

**For each scope argument:**
- Resolve declaration, get TypeScript Type
- Classify by signatures: construct → class target, call → function target, otherwise → object target
- Dispatch: `startTraversalAtClass`, `startTraversalAtFunction`, or `startTraversalAtObject` → transitive type traversal

**Type traversal:**
- Check primitive → return system type
- Check cache by structural equality (symbol ID + stringified type)
- Create placeholder (cycle breaking)
- Call `traverseComplexTSType` (see Type System Handling)
- Finalize: replace placeholder or record alias
- Set `__module` (from payload), `__accessorPath` (for same-file classes/methods), `__magicArgumentPath` (explicit args only)

**Transitive discovery:**
Classes reference other classes → recursive traversal → discovers full type graph

**Special case - spawn sites:**
- Skip output type traversal (spawn returns `Agent`, not user-defined type)
- Still traverse scope concepts if provided

### 3. Form processed records (`processor/processor-utils.ts`)
**From traversal records:**
- `defName`: Symbol name or generated (`___anonymous__resource_123`)
- `importModule`: Source file path (from `payload.module` or `__module`)
  - For `@types/*` packages: mapped to runtime package via `runtimeMappings` config or heuristic
  - Example: `@types/three/src/math/Color.d.ts` → `three/src/math/Color.d.ts`
- `accessorPath`: Computed path for methods/transitives (from `__accessorPath`)
- `magicArgumentPath`: User-provided path (from `__magicArgumentPath`)
- `systemInternalType`: Runtime type with no module/magic path (stdlib methods)
- `declarationOnly`: From `@types/*` packages with no runtime mapping available

**Runtime representation:**
- `ConceptContext` is a plain JavaScript object `{ "1001": {...}, "1000": {...} }` at runtime (not a Map)
- `defMsg` is a JSON string, not a parsed object
- `defGetter` is an optional direct expression reference to the runtime value

**UID alias resolution:**
- Walk all messages, replace aliased UID references with canonical UIDs
- Removes placeholder artifacts from type parameter resolution

### 4. Generate context and getters (`codegen/context-gen.ts`)
**Build import map:**
- Cross-file types → create dynamic imports with full subpath
  - Example: `import { Color } from 'three/src/math/Color'` (not just `'three'`)
- Skip: same-file, `declarationOnly` types, type-only exports, interfaces

**For each record:**
- Generate `defName`, `defMsg` (serialized type)
- Add debug flags: `systemInternalType`, `declarationOnly`
- **Getter generation** (three cases):
  1. Explicitly passed (`magicArgumentPath` set) → uses original expression or reconstructs `foo.bar`
  2. Same-file transitive (has module, no import, has `accessorPath`) → references local `Fiddler`
  3. Cross-file (has import) → references import alias `__import_Fiddler_f2r5`
- Validation: skip reserved keywords, invalid identifiers, `__` internals

### 5. Full IIFE is generated

**Magic transformation example:**
```typescript
const result = await magic<string>("prompt", { foo, bar });
```
becomes:
```typescript
const result = await (() => {
    const __MAGIC_CONTEXT__ = {
        "1000": {
            defName: "foo",
            defMsg: "{...}",
            defGetter: foo
        },
        "1001": {
            defName: "bar",
            defMsg: "{...}",
            defGetter: bar
        }
    };
    const __MAGIC_ID__ = 2;
    const __MAGIC_OUTPUT__ = "{...}";
    return magicTransformation({
        concepts: __MAGIC_CONTEXT__,
        siteId: __MAGIC_ID__,
        siteOutputType: __MAGIC_OUTPUT__,
        docString: "..."
    }, "prompt");
})();
```

**Spawn transformation example:**
```typescript
const agent = await spawn({ premise: "..." }, { obj1, obj2 });
```
becomes:
```typescript
const agent = await (() => {
    const __MAGIC_CONTEXT__ = {
        "1000": { defName: "obj1", defMsg: "{...}", defGetter: obj1 },
        "1001": { defName: "obj2", defMsg: "{...}", defGetter: obj2 }
    };
    const __MAGIC_ID__ = 160;
    return spawnTransformation({
        siteId: __MAGIC_ID__,
        concepts: __MAGIC_CONTEXT__  // Only included if scope provided
    }, { premise: "..." });
})();
```

**Agent call transformation example:**
```typescript
const result = await agent.call<number>("prompt", { fiddler });
```
becomes:
```typescript
const result = await (() => {
    const __MAGIC_CONTEXT__ = {
        "1002": { defName: "fiddler", defMsg: "{...}", defGetter: fiddler }
    };
    const __MAGIC_ID__ = 161;
    const __MAGIC_OUTPUT__ = "{...}";
    return agent.callTransformation({
        concepts: __MAGIC_CONTEXT__,
        siteId: __MAGIC_ID__,
        siteOutputType: __MAGIC_OUTPUT__,
        docString: undefined
    }, "prompt");
})();
```

See `codegen/context-gen.ts` and `transformer-utils.ts`.

### 6. Runtime concept flow

**Spawn concepts (globals):**
- Sent once during agent initialization via `warp_globals_payload` in `csm.newAgent()`
- Available for the entire agent lifetime
- Example: `spawn({ premise: "..." }, { obj1, obj2 })` → `obj1`, `obj2` become agent globals

**Call concepts (locals):**
- Sent per invocation via `warpLocalsPayload` in `csm.invokeAgent()`
- Local to that specific call
- Example: `agent.call("...", { fiddler })` → `fiddler` available only for this call

**Processing:**
1. `ingestLocals(conceptContext)` in `frame.ts` receives plain object `{ "1000": {...}, "1001": {...} }`
2. Parses each entry: `defName`, `defMsg` (JSON string), `defGetter` (runtime value)
3. Rehydrates messages and reconstructs resources
4. Registers concepts in frame context for RPC serialization

## Type System Handling

### Primitives (`tryPrimitiveType` in `system-traversal.ts`)
- String, Number, Boolean, Null, Undefined, Void, Any, Never, Unknown
- Literals: StringLiteral, NumberLiteral, BooleanLiteral
- Symbol (ESSymbol, UniqueESSymbol)
- BigInt, BigIntLiteral
- NonPrimitive (the `object` keyword type)
- TemplateLiteral (`` `hello-${string}` ``)

### System Generics (`tryCreateSystemMessage` in `system-traversal.ts`)
- Union, Intersection
- Array<T>
- Tuple types (`[A, B]` → creates Tuple message with indexed type args)
- Promise<T>, PromiseLike<T>
- Set<T>, Map<K,V>, Record<K,V>
- Enum types (detected via symbol declarations, creates Enum message with keys/values)
- Index-signature objects (`{ [key: string]: Value }`)

### Type Aliases (`traverseComplexTSType` in `traverser.ts`)
- Conditional: `T extends U ? X : Y` → converted to union of both branches
- TypeParameter: `T` → resolved via constraint, fallback to object
- IndexedAccess: `T["key"]` → resolved via `getApparentType`
- Substitution: Unwrapped to base type

### Complex Types (`traverseComplexTSType`)
- Functions: Via call signatures → `FunctionMsg`
- Classes: Via `buildClassMessage` → `ClassMsg` or `InterfaceMsg`
- Objects: Anonymous object types → treated as classes

### Special Handling
- `globalThis`: Early stop, returns `object` (prevents global pollution)
- `__` prefixed members: Skipped during member enumeration (TS internals, global augmentations)
- Mapped types (`Partial<T>`, etc.): TS eagerly resolves → traversed as resolved object types
- Enums: Classified as object targets (no construct signature), but unpeeled in `startTraversalAtObject` to return enum class message directly without ObjectMsg wrapper

### Type Aliases
Type parameters/conditionals that resolve to unfinished types create aliases in `uidAliases`. Post-processing replaces all UID references and removes aliased entries.

## Configuration

Configure transformer behavior via compiler options in `tsconfig.json`:

```typescript
{
  "compilerOptions": {
    // Map @types packages to runtime packages
    "runtimeMappings": {
      "three": "three",        // @types/three → three
      "lodash": "lodash-es"    // @types/lodash → lodash-es
    },
    
    // Control traversal depth (default: 2)
    "traversalDepth": 3
  }
}
```

**Runtime Mapping:**
- Maps `@types/*` packages to their runtime counterparts
- Without mapping, uses heuristic: checks if `.js` file exists alongside `.d.ts`
- Enables importing transitively discovered types from external libraries
- Generates subpath imports: `import { Color } from 'three/src/math/Color'`

**Traversal Depth:**
- Controls how deeply nested types are traversed
- Higher values capture more transitive types but increase build time
- Default: 2 (configurable via `traversalDepth` compiler option)

## Debugging

Site-scoped logging via `TS_LOG_LEVEL`:

```bash
# Find site ID
npm run build | grep "Site.*your-file"

# Debug that site only
TS_LOG_LEVEL=silent,processor:site-N:debug npm run build

# Traversal only
TS_LOG_LEVEL=silent,processor:site-N:traverser:debug npm run build
```

See `AGENT.md` for detailed architecture and issue analysis.

## Important Notes

### Compile-time vs Runtime Types

**Compile-time (transformer):**
- `ConceptContext = Map<DefnUID, ProcessedRecord>` (TypeScript type for transformer code)
- `ProcessedRecord.defMsg: DefMsg` (typed as message object during traversal)

**Runtime (generated code):**
- `ConceptContext = { "1000": {...}, "1001": {...} }` (plain JavaScript object)
- `ProcessedRecord.defMsg: string` (JSON-serialized message)
- Uses `Object.entries()`, `Object.keys()` to iterate
- Must use `Object.keys(concepts).length`, not `concepts.size`

This mismatch exists because:
1. The transformer works with TypeScript AST and needs proper typing
2. Generated code must be JSON-serializable for RPC transmission
3. `ingestLocals()` expects plain objects at runtime

### Transformation Types

**Three distinct transformation targets:**
1. `magicTransformation()` - ephemeral agent, returns typed result
2. `spawnTransformation()` - persistent agent, returns `Agent` instance
3. `agent.callTransformation()` - invocation on existing agent, returns typed result

Each has different context requirements and runtime behavior.

## Issues

* properly deal with `typeof ClassName`
  * this is a *constructor type* (type of a constructor function)
  * can be detected via `.prototype` field (at runtime, this gives back the prototype object)
  * wherever people use this, they expect a constructor function to be passed