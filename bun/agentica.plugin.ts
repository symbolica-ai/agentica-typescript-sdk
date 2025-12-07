/**
 * Agentica Bun Plugin Preload Script
 *
 * This file is automatically loaded by Bun when configured in bunfig.toml.
 * It registers the Agentica transformer plugin to handle magic() calls at runtime.
 *
 * ## Automatic Setup
 * Run the setup script to automatically configure your project:
 * ```bash
 * npx agentica-setup
 * ```
 *
 * ## Manual Setup
 * Add to your bunfig.toml:
 * ```toml
 * preload = ["./node_modules/@symbolica/agentica/bun/agentica.plugin.ts"]
 *
 * # For tests:
 * [test]
 * preload = ["./node_modules/@symbolica/agentica/bun/agentica.plugin.ts"]
 * ```
 *
 * ## Advanced Configuration
 * For custom plugin options (e.g., debug logging), create your own preload script:
 * ```typescript
 * // my-agentica-plugin.ts
 * import agenticaPlugin from '@symbolica/agentica/bundlers/bun';
 *
 * Bun.plugin(agenticaPlugin({ debug: true }));
 * ```
 *
 * Then reference your custom file in bunfig.toml:
 * ```toml
 * preload = ["./my-agentica-plugin.ts"]
 * ```
 */

import agenticaPlugin from '@symbolica/agentica/bun';

Bun.plugin(agenticaPlugin());
