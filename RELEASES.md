# Release Configuration

## Version System

The TypeScript SDK uses `get-version.sh` as the single source of truth for versioning. All naked commands default to preview mode with git hash to avoid collisions with production packages.

## Version Modes

| Mode | Format | Use Case |
|------|--------|----------|
| dev | `[semver]-devN` | Local development and testing |
| prev | `[semver]-devN-[gitsha]` | Preview builds with git commit hash |
| prod | `[semver]-[suffix]` | Release builds (default suffix: `rc`) |

## Version Sync Commands

| Command | Mode | Output | Notes |
|---------|------|--------|-------|
| `version:sync` | prev | `[semver]-devN-[gitsha]` | Default for all naked calls |
| `version:sync:dev` | dev | `[semver]-devN` | Development builds |
| `version:sync:prev` | prev | `[semver]-devN-[gitsha]` | Preview with git hash |
| `version:sync:prod` | prod | `[semver]-rc` | Accepts optional suffix argument |
| `version:sync:prod -- alpha` | prod | `[semver]-alpha` | Custom suffix example |

## Pack Commands

| Command | Version Mode | Output Package |
|---------|--------------|----------------|
| `pack` | prev | `symbolica-agentica-[semver]-devN-[gitsha].tgz` |
| `pack:dev` | dev | `symbolica-agentica-[semver]-devN.tgz` |
| `pack:prev` | prev | `symbolica-agentica-[semver]-devN-[gitsha].tgz` |
| `pack:prod` | prod (rc) | `symbolica-agentica-[semver]-rc.tgz` |
| `RELEASE_SUFFIX=alpha pack:prod` | prod (custom) | `symbolica-agentica-[semver]-alpha.tgz` |

### Production Builds

Using default suffix:
```bash
bun run pack:prod
# Produces: symbolica-agentica-[semver]-rc.tgz
```

Using environment variable:
```bash
RELEASE_SUFFIX=alpha bun run pack:prod
# Produces: symbolica-agentica-[semver]-alpha.tgz
```

Or using version:sync:prod directly:
```bash
bun run version:sync:prod -- beta && bun run clean && bun run gen && bun run build:transformer && bun run build:pack:prod && bun pack
# Produces: symbolica-agentica-[semver]-beta.tgz
```

## Build Commands

| Command | Version Mode | Purpose |
|---------|--------------|---------|
| `build` | none | Compile TypeScript (no version sync) |
| `build:transformer` | none | Build transformer (no version sync) |
| `build:all` | prev | Full build with version sync |
| `build:pack` | prev | Build for packaging |
| `build:pack:dev` | dev | Build for development packaging |
| `build:pack:prod` | prod (rc) | Build for production packaging |
| `build:all:pack` | prev | Full build for packaging |

## Script Arguments

The `sync-version-from-git.js` script accepts:

| Argument | Description | Default |
|----------|-------------|---------|
| `dev` | Development version | - |
| `prev` | Preview version with git hash | - |
| `prod [suffix]` | Production version with optional suffix | `rc` |
| (no argument) | Defaults to prev mode | - |
