#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import * as clack from '@clack/prompts';
import pc from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We're inside '/dist/bin', and the default configs in '/default-configs'
const DEFAULT_CONFIG_DIR = path.join(__dirname, '..', '..', 'default-configs');

const TRANSFORMER_MODULE = '@symbolica/agentica/transformer';

type BuildTool = 'nextjs' | 'vite' | 'webpack' | 'rollup' | 'esbuild' | 'tsc' | 'bun' | null;

interface SetupContext {
    interactive: boolean;
    buildTool: BuildTool;
    cwd: string;
    packageManager: Pacman;
}

function readDefaultConfig(templateName: string): string | null {
    const templatePath = path.join(DEFAULT_CONFIG_DIR, templateName);
    if (!fs.existsSync(templatePath)) {
        clack.log.error(`Default config template not found: ${templatePath}`);
        return null;
    }
    return fs.readFileSync(templatePath, 'utf8');
}

abstract class Pacman {
    abstract get name(): string;
    abstract get exec(): string;
    abstract get init(): string;
    abstract get runtime(): string;

    abstract install(packages?: string | string[]): string;
    abstract installDev(packages?: string | string[]): string;
    abstract run(script?: string): string;
    abstract create(template: string, projectName: string): string;
}

class NpmPacman extends Pacman {
    get name() {
        return 'npm';
    }
    get exec() {
        return 'npx';
    }
    get init() {
        return 'npm init -y';
    }
    get runtime() {
        return 'node';
    }

    install(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `npm install ${pkgs}` : 'npm install';
    }

    installDev(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `npm install --save-dev ${pkgs}` : 'npm install --save-dev';
    }

    run(script?: string): string {
        return script ? `npm run ${script}` : 'npm run';
    }

    create(template: string, projectName: string): string {
        switch (template) {
            case 'react-app':
                return `npx create-react-app ${projectName} --template typescript`;
            case 'vite':
                return `npm create vite@latest ${projectName} -- --template react-ts`;
            case 'next-app':
                return `npx create-next-app@latest ${projectName} --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"`;
            default:
                return `npm create ${template} ${projectName}`;
        }
    }
}

class PnpmPacman extends Pacman {
    get name() {
        return 'pnpm';
    }
    get exec() {
        return 'pnpm exec';
    }
    get init() {
        return 'pnpm init';
    }
    get runtime() {
        return 'node';
    }

    install(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `pnpm install ${pkgs}` : 'pnpm install';
    }

    installDev(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `pnpm install --save-dev ${pkgs}` : 'pnpm install --save-dev';
    }

    run(script?: string): string {
        return script ? `pnpm run ${script}` : 'pnpm run';
    }

    create(template: string, projectName: string): string {
        switch (template) {
            case 'react-app':
                return `pnpm create react-app ${projectName} --template typescript`;
            case 'vite':
                return `pnpm create vite ${projectName} --template react-ts`;
            case 'next-app':
                return `pnpm create next-app ${projectName} --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"`;
            default:
                return `pnpm create ${template} ${projectName}`;
        }
    }
}

class YarnPacman extends Pacman {
    get name() {
        return 'yarn';
    }
    get exec() {
        return 'yarn dlx';
    }
    get init() {
        return 'yarn init -y';
    }
    get runtime() {
        return 'node';
    }

    install(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `yarn add ${pkgs}` : 'yarn install';
    }

    installDev(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `yarn add --dev ${pkgs}` : 'yarn add --dev';
    }

    run(script?: string): string {
        return script ? `yarn run ${script}` : 'yarn run';
    }

    create(template: string, projectName: string): string {
        switch (template) {
            case 'react-app':
                return `yarn create react-app ${projectName} --template typescript`;
            case 'vite':
                return `yarn create vite ${projectName} --template react-ts`;
            case 'next-app':
                return `yarn create next-app ${projectName} --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"`;
            default:
                return `yarn create ${template} ${projectName}`;
        }
    }
}

class BunPacman extends Pacman {
    get name() {
        return 'bun';
    }
    get exec() {
        return 'bunx';
    }
    get init() {
        return 'bun init -y';
    }
    get runtime() {
        return 'bun';
    }

    install(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `bun add ${pkgs}` : 'bun install';
    }

    installDev(packages?: string | string[]): string {
        const pkgs = packages ? (Array.isArray(packages) ? packages.join(' ') : packages) : '';
        return pkgs ? `bun add --dev ${pkgs}` : 'bun add --dev';
    }

    run(script?: string): string {
        return script ? `bun run ${script}` : 'bun run';
    }

    create(template: string, projectName: string): string {
        switch (template) {
            case 'react-app':
                return `bun create react-app ${projectName} --template typescript`;
            case 'vite':
                return `bun create vite ${projectName} --template react-ts`;
            case 'next-app':
                return `bunx create-next-app ${projectName} --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"`;
            default:
                return `bun create ${template} ${projectName}`;
        }
    }
}

interface PackageJson {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    agentica?: {
        telemetry?: boolean;
    };
    [key: string]: unknown;
}

function detectPackageManager(): Pacman {
    const userAgent = process.env.npm_config_user_agent || '';

    if (userAgent.includes('pnpm')) {
        return new PnpmPacman();
    }
    if (userAgent.includes('yarn')) {
        return new YarnPacman();
    }
    if (userAgent.includes('bun')) {
        return new BunPacman();
    }
    // Default to npm (includes npx and direct npm usage)
    return new NpmPacman();
}

function getBuildToolDisplayName(buildTool: BuildTool): string {
    switch (buildTool) {
        case 'nextjs':
            return 'Next.js';
        case 'vite':
            return 'Vite';
        case 'webpack':
            return 'Webpack';
        case 'rollup':
            return 'Rollup';
        case 'esbuild':
            return 'esbuild';
        case 'tsc':
            return 'TypeScript CLI';
        case 'bun':
            return 'Bun';
        default:
            return 'build tool';
    }
}

function readJson(filePath: string): PackageJson {
    const content = fs.readFileSync(filePath, 'utf8');
    const stripped = content.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match, group) =>
        group ? '' : match
    );
    return JSON.parse(stripped);
}

function writeJson(filePath: string, object: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(object, null, 2) + '\n', 'utf8');
}

function isAlreadyConfigured(tsconfigPath: string): boolean {
    if (!fs.existsSync(tsconfigPath)) return false;
    const content = fs.readFileSync(tsconfigPath, 'utf8');
    return content.includes(TRANSFORMER_MODULE);
}

function updateTsConfig(tsconfigPath: string): boolean {
    if (!fs.existsSync(tsconfigPath)) {
        clack.log.warn(`tsconfig.json not found at ${tsconfigPath}`);
        return false;
    }

    let content = fs.readFileSync(tsconfigPath, 'utf8');

    if (content.includes(TRANSFORMER_MODULE)) {
        return false;
    }

    const pluginEntry = `{ "transform": "${TRANSFORMER_MODULE}" }`;

    if (content.includes('"plugins"')) {
        content = content.replace(/("plugins"\s*:\s*\[)/, `$1${pluginEntry}, `);
    } else if (content.includes('"compilerOptions"')) {
        content = content.replace(/("compilerOptions"\s*:\s*\{)/, `$1\n    "plugins": [${pluginEntry}],`);
    } else {
        clack.log.warn('Could not find compilerOptions in tsconfig.json');
        return false;
    }

    fs.writeFileSync(tsconfigPath, content, 'utf8');
    return true;
}

function inferRollupOutputDir(cwd: string): string {
    const candidates = ['rollup.config.ts', 'rollup.config.mjs', 'rollup.config.js'];
    for (const name of candidates) {
        const cfgPath = path.join(cwd, name);
        if (!fs.existsSync(cfgPath)) continue;
        try {
            const cfg = fs.readFileSync(cfgPath, 'utf8');
            // Try to find output: { ... file: '...' ... } or output: { ... dir: '...' ... }
            const fileMatch = cfg.match(/file\s*:\s*['"]([^'"]+)['"]/);
            const dirMatch = cfg.match(/dir\s*:\s*['"]([^'"]+)['"]/);
            if (dirMatch) {
                return dirMatch[1];
            }
            if (fileMatch) {
                return path.dirname(fileMatch[1]);
            }
        } catch {
            // ignore and fall through to default
        }
    }
    // Default Rollup output directory
    return 'dist';
}

function updateRollupTsConfig(cwd: string): void {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
        clack.log.warn(
            `tsconfig.json not found at ${tsconfigPath} - please ensure your TypeScript config is compatible with Rollup.`
        );
        return;
    }

    const tsconfig = readJson(tsconfigPath) as { compilerOptions?: Record<string, unknown> };
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    const co = tsconfig.compilerOptions as Record<string, any>;

    // Ensure a modern module setup for bundlers
    const module = typeof co.module === 'string' ? co.module.toLowerCase() : '';
    if (
        !module ||
        module === 'commonjs' ||
        module === 'amd' ||
        module === 'system' ||
        module === 'umd' ||
        module === 'preserve'
    ) {
        co.module = 'ESNext';
    }

    const modRes = typeof co.moduleResolution === 'string' ? co.moduleResolution.toLowerCase() : '';
    if (!modRes || modRes === 'classic' || modRes === 'bundler') {
        co.moduleResolution = 'bundler';
    }

    // Make sure interop options are enabled for typical Node ESM/CommonJS deps
    if (co.esModuleInterop !== true) {
        co.esModuleInterop = true;
    }
    if (co.allowSyntheticDefaultImports !== true) {
        co.allowSyntheticDefaultImports = true;
    }

    // Remove allowImportingTsExtensions entirely – @rollup/plugin-typescript
    // forces noEmit internally, which triggers TS5096 if this flag is present.
    // Rollup does not require it for .ts imports.
    if (co.allowImportingTsExtensions) {
        delete co.allowImportingTsExtensions;
        clack.log.info('Removed "allowImportingTsExtensions" from tsconfig.json for Rollup compatibility.');
    }

    // Ensure outDir matches Rollup's output directory (derived from rollup.config.*)
    const desiredOutDir = inferRollupOutputDir(cwd);
    if (typeof co.outDir !== 'string') {
        co.outDir = desiredOutDir;
    } else {
        const outDirAbs = path.resolve(cwd, co.outDir);
        const rollupOutDir = path.resolve(cwd, desiredOutDir);
        const rel = path.relative(rollupOutDir, outDirAbs);
        if (rel !== '') {
            co.outDir = desiredOutDir;
            clack.log.info('Updated "outDir" in tsconfig.json to "dist" for Rollup compatibility.');
        }
    }

    writeJson(tsconfigPath, tsconfig);
    clack.log.info('Updated tsconfig.json for Rollup + TypeScript.');
}

function normalizeRollupInput(config: string, cwd: string): string {
    const desiredInput = getEntryPointPath(cwd);

    // Replace the first occurrence of input: '...'
    return config.replace(/input:\s*['"][^'"]*['"]/, `input: '${desiredInput}'`);
}

function getEntryPointPath(cwd: string): string {
    const srcIndex = path.join(cwd, 'src', 'index.ts');
    const rootIndex = path.join(cwd, 'index.ts');

    if (fs.existsSync(srcIndex)) {
        return 'src/index.ts';
    } else if (fs.existsSync(rootIndex)) {
        return 'index.ts';
    } else {
        // Default fallback
        return 'src/index.ts';
    }
}

function maybeWriteHelloWorldIndex(cwd: string): void {
    const srcDir = path.join(cwd, 'src');
    const srcIndex = path.join(srcDir, 'index.ts');
    const rootIndex = path.join(cwd, 'index.ts');
    const template = readDefaultConfig('agentica-hello-world.ts');

    if (!template) {
        return;
    }

    const existsSrc = fs.existsSync(srcIndex);
    const existsRoot = fs.existsSync(rootIndex);

    // Helper to decide if an existing index.ts is "trivial"
    function isTrivialIndex(filePath: string): boolean {
        const content = fs.readFileSync(filePath, 'utf8');
        const nonEmptyLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const isShort = nonEmptyLines.length < 4;
        const hasTrivialContent = /console\.log|Hello/i.test(content);
        return isShort && hasTrivialContent;
    }

    // No index.ts anywhere: create src/index.ts by default
    if (!existsSrc && !existsRoot) {
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }
        fs.writeFileSync(srcIndex, template, 'utf8');
        clack.log.info("Created Agentica hello-world example at 'src/index.ts'");
        return;
    }

    // If exactly one index.ts exists, potentially overwrite that one if trivial
    if (existsSrc !== existsRoot) {
        const target = existsSrc ? srcIndex : rootIndex;
        if (isTrivialIndex(target)) {
            fs.writeFileSync(target, template, 'utf8');
            const label = target === srcIndex ? 'src/index.ts' : 'index.ts';
            clack.log.info(`Replaced trivial '${label}' with Agentica hello-world example`);
        }
        return;
    }

    // Both exist: only touch them if BOTH are trivial; otherwise leave user code alone
    const srcTrivial = isTrivialIndex(srcIndex);
    const rootTrivial = isTrivialIndex(rootIndex);

    if (srcTrivial && rootTrivial) {
        fs.writeFileSync(srcIndex, template, 'utf8');
        clack.log.info("Replaced trivial 'src/index.ts' with Agentica hello-world example");
    }
}

function getMissingDependencies(cwd: string, names: string[]): string[] {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return names;
    }

    const pkg = readJson(pkgPath);
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    return names.filter((name) => !(name in deps) && !(name in devDeps));
}

function ensureDevDependencies(context: SetupContext, names: string[]): boolean {
    const missing = getMissingDependencies(context.cwd, names);
    if (missing.length === 0) {
        return true;
    }

    const pm = context.packageManager;
    const command = pm.installDev(missing);

    clack.log.info(`Installing dev dependencies: ${missing.join(', ')}`);
    clack.log.step(pc.cyan(command));

    try {
        execSync(command, { stdio: 'inherit', cwd: context.cwd });
        return true;
    } catch (error) {
        clack.log.error('Failed to install dev dependencies');
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    }
}

function ensureDependencies(context: SetupContext, names: string[]): boolean {
    const missing = getMissingDependencies(context.cwd, names);
    if (missing.length === 0) {
        return true;
    }

    const pm = context.packageManager;
    const command = pm.install(missing);

    clack.log.info(`Installing dependencies: ${missing.join(', ')}`);
    clack.log.step(pc.cyan(command));

    try {
        execSync(command, { stdio: 'inherit', cwd: context.cwd });
        return true;
    } catch (error) {
        clack.log.error('Failed to install dependencies');
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    }
}

function detectBuildTool(cwd: string, packageManager?: Pacman): BuildTool {
    const checks: Array<{ tool: Exclude<BuildTool, null>; files: string[] }> = [
        {
            tool: 'nextjs',
            files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
        },
        {
            tool: 'vite',
            files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
        },
        {
            tool: 'rollup',
            files: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
        },
        {
            tool: 'webpack',
            files: ['webpack.config.js', 'webpack.config.ts'],
        },
        {
            tool: 'esbuild',
            files: ['esbuild.config.js', 'esbuild.config.ts', 'build.js', 'build.ts'],
        },
        {
            tool: 'bun',
            files: ['bunfig.toml', 'bun.lockb'],
        },
    ];

    for (const check of checks) {
        if (check.files.some((file) => fs.existsSync(path.join(cwd, file)))) {
            return check.tool;
        }
    }

    // If using Bun package manager and has tsconfig, suggest Bun as build tool
    if (packageManager && packageManager.name === 'bun' && fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
        return 'bun';
    }

    if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
        return 'tsc';
    }

    return null;
}

function setupNextJS(context: SetupContext): boolean {
    // Ensure Next.js is installed (typically as a regular dependency)
    ensureDependencies(context, ['next']);

    const configPaths = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
    const configPath = configPaths.find((p) => fs.existsSync(path.join(context.cwd, p)));

    if (!configPath) {
        const fullPath = path.join(context.cwd, 'next.config.ts');
        const defaultConfig = readDefaultConfig('next.config.ts');

        if (!defaultConfig) {
            return false;
        }

        fs.writeFileSync(fullPath, defaultConfig, 'utf8');
        updateTsConfig(path.join(context.cwd, 'tsconfig.json'));
        clack.log.info('Created default Next.js config with Agentica');
        return true;
    }

    const fullPath = path.join(context.cwd, configPath);
    let config = fs.readFileSync(fullPath, 'utf8');

    if (config.includes('@symbolica/agentica/next') && config.includes('withAgentica(')) {
        clack.log.info('Next.js config already configured');
        return true;
    }
    const wrapperImport = `import { withAgentica } from '@symbolica/agentica/next';\n\n`;
    config = wrapperImport + config;

    if (config.includes('module.exports = {')) {
        const exportMatch = config.match(/module\.exports\s*=\s*(\{[\s\S]*\});?\s*$/m);
        if (exportMatch) {
            const configObject = exportMatch[1];
            config = config.replace(
                /module\.exports\s*=\s*\{[\s\S]*\};?\s*$/m,
                `module.exports = withAgentica(${configObject});`
            );
        }
    } else if (config.match(/const\s+(\w+)\s*=\s*\{/)) {
        const variableMatch = config.match(/const\s+(\w+)\s*=\s*(\{[\s\S]*?\n\});/);
        if (variableMatch) {
            const variableName = variableMatch[1];
            const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            config = config.replace(
                new RegExp(`module\\.exports\\s*=\\s*${escapedName};?`),
                `module.exports = withAgentica(${variableName});`
            );
        }
    } else if (config.includes('export default {')) {
        config = config.replace(
            /export\s+default\s+(\{[\s\S]*\});?\s*$/m,
            (match, configObject) => `export default withAgentica(${configObject});`
        );
    } else if (config.match(/export\s+default\s+(\w+);?/)) {
        config = config.replace(
            /export\s+default\s+(\w+);?/,
            (match, variableName) => `export default withAgentica(${variableName});`
        );
    } else {
        clack.log.warn('Could not parse Next.js config format');
        return false;
    }

    updateTsConfig(path.join(context.cwd, 'tsconfig.json'));
    fs.writeFileSync(fullPath, config, 'utf8');
    return true;
}

function setupVite(context: SetupContext): boolean {
    // Ensure Vite is installed as a dev dependency
    ensureDevDependencies(context, ['vite']);

    const configPaths = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
    const configPath = configPaths.find((p) => fs.existsSync(path.join(context.cwd, p)));

    if (!configPath) {
        const fullPath = path.join(context.cwd, 'vite.config.ts');
        const defaultConfig = readDefaultConfig('vite.config.ts');

        if (!defaultConfig) {
            return false;
        }

        fs.writeFileSync(fullPath, defaultConfig, 'utf8');
        clack.log.info('Created default Vite config with Agentica');
        return true;
    }

    const fullPath = path.join(context.cwd, configPath);
    let config = fs.readFileSync(fullPath, 'utf8');

    if (config.includes('@symbolica/agentica/vite') && config.includes('agentica()')) {
        clack.log.info('Vite config already configured');
        return true;
    }

    const importLine = `import agentica from '@symbolica/agentica/vite';\n`;

    if (!config.includes(importLine)) {
        config = importLine + config;
    }

    if (config.includes('plugins: [')) {
        config = config.replace('plugins: [', 'plugins: [agentica(), ');
    } else if (config.includes('plugins:')) {
        config = config.replace('plugins:', 'plugins: [agentica()],');
    } else if (config.includes('defineConfig({')) {
        config = config.replace('defineConfig({', 'defineConfig({\n  plugins: [agentica()],');
    } else {
        clack.log.warn('Could not parse Vite config format');
        return false;
    }

    fs.writeFileSync(fullPath, config, 'utf8');
    return true;
}

function setupWebpack(context: SetupContext): boolean {
    // Ensure Webpack is installed as a dev dependency
    ensureDevDependencies(context, ['webpack']);

    const configPaths = ['webpack.config.js', 'webpack.config.ts'];
    const configPath = configPaths.find((p) => fs.existsSync(path.join(context.cwd, p)));

    if (!configPath) {
        const fullPath = path.join(context.cwd, 'webpack.config.ts');
        const defaultConfig = readDefaultConfig('webpack.config.ts');

        if (!defaultConfig) {
            return false;
        }

        fs.writeFileSync(fullPath, defaultConfig, 'utf8');
        clack.log.info('Created default Webpack config with Agentica');
        return true;
    }

    const fullPath = path.join(context.cwd, configPath);
    let config = fs.readFileSync(fullPath, 'utf8');

    if (config.includes('@symbolica/agentica/webpack') && config.includes('agentica()')) {
        clack.log.info('Webpack config already configured');
        return true;
    }
    const importLine = `import agentica from '@symbolica/agentica/webpack';\n`;
    config = importLine + config;

    if (config.includes('plugins: [')) {
        config = config.replace('plugins: [', 'plugins: [agentica(), ');
    } else if (config.includes('plugins:')) {
        config = config.replace('plugins:', 'plugins: [agentica()],');
    } else if (config.includes('module.exports = {')) {
        config = config.replace('module.exports = {', 'module.exports = {\n  plugins: [agentica()],');
    } else {
        clack.log.warn('Could not parse Webpack config format');
        return false;
    }

    fs.writeFileSync(fullPath, config, 'utf8');
    return true;
}

function setupRollup(context: SetupContext): boolean {
    // Ensure Rollup, node-resolve, and TypeScript plugin are installed as dev dependencies
    ensureDevDependencies(context, ['rollup', '@rollup/plugin-node-resolve', '@rollup/plugin-typescript']);

    const configPaths = ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'];
    const configPath = configPaths.find((p) => fs.existsSync(path.join(context.cwd, p)));

    if (!configPath) {
        const fullPath = path.join(context.cwd, 'rollup.config.ts');
        const defaultConfig = readDefaultConfig('rollup.config.ts');

        if (!defaultConfig) {
            return false;
        }

        const normalizedConfig = normalizeRollupInput(defaultConfig, context.cwd);
        fs.writeFileSync(fullPath, normalizedConfig, 'utf8');
        clack.log.info('Created default Rollup config with Agentica');

        // Normalize tsconfig.json for Rollup + TypeScript
        updateRollupTsConfig(context.cwd);
        return true;
    }

    const fullPath = path.join(context.cwd, configPath);
    let config = fs.readFileSync(fullPath, 'utf8');

    if (config.includes('@symbolica/agentica/transformer') && config.includes('transformers:')) {
        clack.log.info('Rollup config already configured with Agentica transformer');
        return true;
    }

    const transformerImport = `import agenticaTransformer from '@symbolica/agentica/transformer';\n`;
    const nodeResolveImport = `import { nodeResolve } from '@rollup/plugin-node-resolve';\n`;
    const typescriptImport = `import typescript from '@rollup/plugin-typescript';\n`;

    if (!config.includes(nodeResolveImport)) {
        config = nodeResolveImport + config;
    }
    if (!config.includes(typescriptImport)) {
        config = typescriptImport + config;
    }
    if (!config.includes(transformerImport)) {
        config = transformerImport + config;
    }

    const tsPluginSnippet = `
    typescript({
      tsconfig: 'tsconfig.json',
      transformers: (program) => ({
        before: [agenticaTransformer(program)],
      }),
    }),`;

    // Ensure TypeScript plugin with Agentica transformer is registered
    if (config.includes('plugins: [')) {
        config = config.replace('plugins: [', `plugins: [${tsPluginSnippet}`);
    } else if (config.includes('plugins:')) {
        config = config.replace('plugins:', `plugins: [${tsPluginSnippet}`);
    } else if (config.includes('export default {')) {
        const pluginsBlock = `  plugins: [${tsPluginSnippet}
  ],\n`;
        config = config.replace('export default {', `export default {\n${pluginsBlock}`);
    } else {
        clack.log.warn('Could not parse Rollup config format');
        return false;
    }

    // Ensure Node built-ins and OTEL/grpc packages are marked as external if not already configured
    if (!config.includes('external: [')) {
        const externalBlock = `  external: [
    // Node.js built-ins
    'async_hooks',
    'crypto',
    'fs',
    'http',
    'https',
    'net',
    'tls',
    'zlib',
    'events',
    'stream',
    'util',
    'buffer',
    'url',
    'path',
    // gRPC - server-side only
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],\n`;

        if (config.includes('export default {')) {
            config = config.replace('export default {', `export default {\n${externalBlock}`);
        } else {
            // Fallback: try to inject into a top-level config object
            const configObjectMatch = config.match(/const\s+(\w+)\s*=\s*\{/);
            if (configObjectMatch) {
                const fullMatch = configObjectMatch[0];
                config = config.replace(fullMatch, `${fullMatch}\n${externalBlock}`);
            }
        }
    }

    // Ensure inlineDynamicImports is enabled for single-file output when possible
    if (config.includes('output: {') && !config.includes('inlineDynamicImports')) {
        config = config.replace('output: {', 'output: {\n    inlineDynamicImports: true,');
    }

    config = normalizeRollupInput(config, context.cwd);
    fs.writeFileSync(fullPath, config, 'utf8');

    // Normalize tsconfig.json for Rollup + TypeScript
    updateRollupTsConfig(context.cwd);
    return true;
}

function setupEsbuild(context: SetupContext): boolean {
    // Ensure esbuild is installed as a dev dependency
    ensureDevDependencies(context, ['esbuild']);

    const configPaths = ['esbuild.config.js', 'esbuild.config.ts', 'build.js', 'build.ts'];
    const configPath = configPaths.find((p) => fs.existsSync(path.join(context.cwd, p)));

    if (!configPath) {
        const fullPath = path.join(context.cwd, 'esbuild.config.ts');
        const defaultConfig = readDefaultConfig('esbuild.config.ts');

        if (!defaultConfig) {
            return false;
        }

        // Adjust entryPoints to match where index.ts actually lives
        const desiredEntry = getEntryPointPath(context.cwd);

        const normalizedConfig = defaultConfig.replace(/entryPoints:\s*\[[^\]]*\]/, `entryPoints: ['${desiredEntry}']`);

        fs.writeFileSync(fullPath, normalizedConfig, 'utf8');
        clack.log.info('Created default esbuild config with Agentica');
        return true;
    }

    const fullPath = path.join(context.cwd, configPath);
    let config = fs.readFileSync(fullPath, 'utf8');

    if (config.includes('@symbolica/agentica/esbuild') && config.includes('agentica()')) {
        clack.log.info('esbuild config already configured');
        return true;
    }
    const importLine = `import agentica from '@symbolica/agentica/esbuild';\n`;
    config = importLine + config;

    if (config.includes('plugins: [')) {
        config = config.replace('plugins: [', 'plugins: [agentica(), ');
    } else if (config.includes('plugins:')) {
        config = config.replace('plugins:', 'plugins: [agentica()],');
    } else {
        clack.log.warn('Could not parse esbuild config format');
        return false;
    }

    // Ensure Node built-ins and gRPC packages are marked as external if not already configured
    if (!config.includes('external:')) {
        const externalBlock = `  external: [
    // Node.js built-ins
    'async_hooks',
    'crypto',
    'fs',
    'http',
    'https',
    'net',
    'tls',
    'zlib',
    'events',
    'stream',
    'util',
    'buffer',
    'url',
    'path',
    // gRPC - server-side only
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],\n`;

        // Try to insert external before the closing of the build config object
        if (config.match(/build\s*\(\s*\{/)) {
            // Find the build({ and insert after it
            config = config.replace(/build\s*\(\s*\{/, (match) => `${match}\n${externalBlock}`);
        }
    }

    // For existing configs, we leave entryPoints/outfile alone; user controls them.
    fs.writeFileSync(fullPath, config, 'utf8');
    return true;
}

function setupTypeScriptCLI(context: SetupContext): boolean {
    const pkgPath = path.join(context.cwd, 'package.json');
    const pkg = readJson(pkgPath);

    let changed = false;

    pkg.devDependencies = pkg.devDependencies || {};
    const hasTsPatch = !!pkg.devDependencies['ts-patch'];
    const hasTypescript = !!pkg.devDependencies['typescript'];

    if (!hasTsPatch) {
        pkg.devDependencies['ts-patch'] = '^3.3.0';
        changed = true;
    }
    if (!hasTypescript) {
        pkg.devDependencies['typescript'] = '^5.0.0';
        changed = true;
    }

    pkg.scripts = pkg.scripts || {};
    const prepareScript = pkg.scripts['prepare'];
    const wantScript = 'ts-patch install -s';
    const hasPrepareScript = !!(prepareScript && prepareScript.includes(wantScript));

    if (!prepareScript) {
        pkg.scripts['prepare'] = wantScript;
        changed = true;
    } else if (!prepareScript.includes(wantScript)) {
        pkg.scripts['prepare'] = `${wantScript} && ${prepareScript}`;
        changed = true;
    }

    if (changed) {
        writeJson(pkgPath, pkg);
        // Install any newly added dev dependencies so the user doesn't have to run npm install manually
        const toInstall: string[] = [];
        if (!hasTsPatch) {
            toInstall.push('ts-patch');
        }
        if (!hasTypescript) {
            toInstall.push('typescript');
        }
        if (toInstall.length > 0) {
            ensureDevDependencies(context, toInstall);
        }
    }

    const tsconfigPath = path.join(context.cwd, 'tsconfig.json');
    const tsconfigUpdated = updateTsConfig(tsconfigPath);
    const tsconfigAlreadyConfigured = !tsconfigUpdated && isAlreadyConfigured(tsconfigPath);

    // Success if: changes were made, OR everything was already properly configured
    const alreadyFullyConfigured = hasTsPatch && hasTypescript && hasPrepareScript && tsconfigAlreadyConfigured;

    return changed || tsconfigUpdated || alreadyFullyConfigured;
}

function setupBun(context: SetupContext): boolean {
    const bunfigPath = path.join(context.cwd, 'bunfig.toml');

    // This script is in dist/bin/, so the package root is two levels up
    const agenticaPackageDir = path.resolve(__dirname, '../..');
    const absolutePluginPath = path.join(agenticaPackageDir, 'bun', 'agentica.plugin.ts');

    // Make it relative to the project root for bunfig.toml
    let preloadPath = path.relative(context.cwd, absolutePluginPath);
    if (!(preloadPath.startsWith('../') || preloadPath.startsWith('./'))) {
        preloadPath = './' + preloadPath;
    }

    let bunfigContent = '';
    let alreadyConfigured = false;

    // Read existing bunfig.toml if it exists
    if (fs.existsSync(bunfigPath)) {
        bunfigContent = fs.readFileSync(bunfigPath, 'utf8');
        // Check for any reference to the Agentica plugin (handles different path styles)
        alreadyConfigured = bunfigContent.includes('agentica/bun/agentica.plugin.ts');
    }

    if (alreadyConfigured) {
        clack.log.info('bunfig.toml already configured with Agentica plugin');
        return true;
    }

    // Parse existing preload configuration
    const preloadMatch = bunfigContent.match(/^preload\s*=\s*(\[.*?\])/m);

    if (preloadMatch) {
        // Add to existing preload array
        const existingArray = preloadMatch[1];
        const newArray = existingArray.replace(']', `, "${preloadPath}"]`);
        bunfigContent = bunfigContent.replace(preloadMatch[0], `preload = ${newArray}`);
    } else {
        // Add new preload configuration
        const preloadConfig = `preload = ["${preloadPath}"]\n`;
        if (bunfigContent.trim()) {
            bunfigContent = preloadConfig + '\n' + bunfigContent;
        } else {
            bunfigContent = preloadConfig;
        }
    }

    // Add test preload configuration
    const testSectionMatch = bunfigContent.match(/^\[test\]/m);
    if (!testSectionMatch) {
        bunfigContent += `\n[test]\npreload = ["${preloadPath}"]\n`;
    } else {
        const testPreloadMatch = bunfigContent.match(/^\[test\]\s*\npreload\s*=\s*(\[.*?\])/m);
        if (testPreloadMatch) {
            const existingArray = testPreloadMatch[1];
            const newArray = existingArray.replace(']', `, "${preloadPath}"]`);
            bunfigContent = bunfigContent.replace(testPreloadMatch[0], `[test]\npreload = ${newArray}`);
        } else {
            bunfigContent = bunfigContent.replace('[test]', `[test]\npreload = ["${preloadPath}"]`);
        }
    }

    fs.writeFileSync(bunfigPath, bunfigContent, 'utf8');
    return true;
}

async function configureBuildTool(context: SetupContext): Promise<boolean> {
    if (!context.buildTool) {
        clack.log.error('No build tool detected');
        return false;
    }

    // For Bun projects, let users choose between Bun plugin and tsc
    if (context.buildTool === 'bun') {
        if (context.interactive) {
            const bunChoice = await clack.select({
                message: 'How would you like to configure Agentica for Bun?',
                options: [
                    {
                        value: 'plugin',
                        label: 'Bun Plugin (Recommended)',
                        hint: "Use Bun's native plugin system via bunfig.toml",
                    },
                    {
                        value: 'tsc',
                        label: 'TypeScript CLI (ts-patch)',
                        hint: 'Use TypeScript transformer with ts-patch',
                    },
                ],
            });

            if (clack.isCancel(bunChoice)) {
                clack.cancel('Setup cancelled');
                process.exit(0);
            }

            // Update build tool based on choice
            context.buildTool = bunChoice === 'plugin' ? 'bun' : 'tsc';
        } else {
            // In automatic mode, default to Bun plugin (recommended)
            clack.log.info('Using Bun plugin (recommended for Bun projects)');
        }
    }

    const actions: Record<Exclude<BuildTool, null>, { message: string; fn: (ctx: SetupContext) => boolean }> = {
        nextjs: {
            message: 'Adding withAgentica() wrapper to next.config',
            fn: setupNextJS,
        },
        vite: {
            message: 'Adding Agentica plugin to vite.config',
            fn: setupVite,
        },
        webpack: {
            message: 'Adding Agentica plugin to webpack.config',
            fn: setupWebpack,
        },
        rollup: {
            message: 'Adding Agentica plugin to rollup.config',
            fn: setupRollup,
        },
        esbuild: {
            message: 'Adding Agentica plugin to esbuild config',
            fn: setupEsbuild,
        },
        bun: {
            message: 'Configuring Bun plugin in bunfig.toml',
            fn: setupBun,
        },
        tsc: {
            message: 'Configuring TypeScript with ts-patch transformer',
            fn: setupTypeScriptCLI,
        },
    };

    const action = actions[context.buildTool];
    const spinner = clack.spinner();

    spinner.start(action.message);

    try {
        const success = action.fn(context);
        if (success) {
            spinner.stop(action.message + ' ' + pc.green('✓'));
        } else {
            spinner.stop(action.message + ' ' + pc.red('✗'));
        }
        return success;
    } catch (error) {
        spinner.stop(action.message + ' ' + pc.red('✗'));
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    }
}

function getEnvFileName(buildTool: BuildTool): string {
    return buildTool === 'nextjs' ? '.env.local' : '.env';
}

function getExistingApiKey(cwd: string, buildTool: BuildTool): string | null {
    const envFile = getEnvFileName(buildTool);
    const envPath = path.join(cwd, envFile);

    if (!fs.existsSync(envPath)) return null;

    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/AGENTICA_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
}

function addToEnvFile(cwd: string, envFileName: string, apiKey: string): void {
    const envPath = path.join(cwd, envFileName);
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('AGENTICA_API_KEY=')) {
            envContent = envContent.replace(/AGENTICA_API_KEY=.*/g, `AGENTICA_API_KEY=${apiKey}`);
        } else {
            envContent += `\nAGENTICA_API_KEY=${apiKey}\n`;
        }
    } else {
        envContent = `AGENTICA_API_KEY=${apiKey}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
}

function updatePackageJsonConfig(cwd: string, telemetry: boolean): void {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = readJson(pkgPath);

    pkg.agentica = pkg.agentica || {};
    pkg.agentica.telemetry = telemetry;

    writeJson(pkgPath, pkg);
}

function getExistingTelemetrySetting(cwd: string): boolean | null {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;

    const pkg = readJson(pkgPath);
    return pkg.agentica?.telemetry ?? null;
}

function checkBundlerModeInTsConfig(tsconfigPath: string): boolean {
    if (!fs.existsSync(tsconfigPath)) return false;

    const content = fs.readFileSync(tsconfigPath, 'utf8');
    // Check if noEmit is set to true (with or without quotes)
    return /["']?noEmit["']?\s*:\s*true/i.test(content);
}

function warnAboutBundlerMode(): void {
    clack.log.warn('');
    clack.log.warn(pc.yellow('⚠️  Bun detected: You cannot use bundler mode with ts-patch'));
    clack.log.warn('');
    clack.log.warn('Please remove these lines from your ' + pc.cyan('tsconfig.json') + ':');
    clack.log.warn('');
    clack.log.warn(
        pc.bgRed(
            pc.white(
                '\n' +
                    `
-   // Bundler mode
-  "moduleResolution": "bundler"
-  "allowImportingTsExtensions": true
-  "verbatimModuleSyntax": true
-  "noEmit": true
    `.trim()
            )
        )
    );
}

async function initializePlainTypeScript(cwd: string, pm: Pacman): Promise<boolean> {
    const pkgPath = path.join(cwd, 'package.json');
    const needsPackageJson = !fs.existsSync(pkgPath);

    // Show the commands that will be run
    clack.log.info('Will run the following commands:');
    if (needsPackageJson) {
        clack.log.step(`  ${pc.cyan(pm.init)}`);
    }
    clack.log.step(`  ${pc.cyan(pm.installDev(['typescript', '@types/node']))}`);
    clack.log.step(`  ${pc.cyan(`${pm.exec} tsc --init`)}`);
    clack.log.info('');

    const confirm = await clack.confirm({
        message: 'Proceed with plain TypeScript setup?',
        initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
        clack.log.warn('Project initialization cancelled');
        return false;
    }

    const spinner = clack.spinner();

    // Create package.json if it doesn't exist
    if (needsPackageJson) {
        spinner.start('Creating package.json');
        try {
            execSync(pm.init, { stdio: 'pipe', cwd });
            spinner.stop('Created package.json ' + pc.green('✓'));
        } catch (error) {
            spinner.stop('Failed to create package.json ' + pc.red('✗'));
            clack.log.error(error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    // Install TypeScript
    spinner.start('Installing TypeScript');
    try {
        execSync(pm.installDev(['typescript', '@types/node']), { stdio: 'pipe', cwd });
        spinner.stop('TypeScript installed ' + pc.green('✓'));
    } catch (error) {
        spinner.stop('Failed to install TypeScript ' + pc.red('✗'));
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    }

    // Create tsconfig.json
    spinner.start('Creating tsconfig.json');
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    try {
        execSync(`${pm.exec} tsc --init`, { stdio: 'pipe', cwd });
        spinner.stop('Created tsconfig.json ' + pc.green('✓'));
    } catch (error) {
        spinner.stop('Failed to create tsconfig.json ' + pc.red('✗'));
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    }

    // Check for bundler mode if using Bun
    if (pm.name === 'bun' && checkBundlerModeInTsConfig(tsconfigPath)) {
        warnAboutBundlerMode();
    }

    // Create src directory and index.ts
    const srcDir = path.join(cwd, 'src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
    }

    const indexPath = path.join(srcDir, 'index.ts');
    if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, `console.log('Hello from TypeScript!');\n`, 'utf8');
    }

    clack.log.success('Plain TypeScript project initialized!');

    clack.log.info('');
    clack.log.info(pc.cyan('Important: ') + pc.bold('Use tspc instead of tsc to compile'));
    clack.log.step('  Compile: ' + pc.yellow(`${pm.exec} tspc`));
    clack.log.step('  Run:     ' + pc.yellow(`${pm.runtime} dist/index.js`));
    clack.log.info('');
    clack.log.warn(
        pc.dim('Note: Runtime tools like ') +
            pc.yellow('tsx') +
            pc.dim(' or ') +
            pc.yellow('ts-node') +
            pc.dim(' will not work with Agentica\n      (transformations are skipped)')
    );

    return true;
}

async function initializeProjectFromTemplate(
    cwd: string,
    pm: Pacman,
    template: 'vite' | 'next-app' | 'react-app'
): Promise<boolean> {
    const projectName = path.basename(cwd).replace(/[^a-zA-Z0-9_-]/g, '-');
    const command = pm.create(template, projectName);

    // Show the command and ask for confirmation
    clack.log.info(`Will run: ${pc.cyan(command)}`);
    clack.log.warn(pc.dim('Note: The command may prompt you for additional setup options'));

    const confirm = await clack.confirm({
        message: 'Proceed with this command?',
        initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
        clack.log.warn('Project initialization cancelled');
        return false;
    }

    clack.log.info(`Creating ${template} project...`);
    clack.log.info('');

    const parentDir = path.dirname(cwd);
    const tempName = `temp-${projectName}-${Date.now()}`;
    const tempPath = path.join(parentDir, tempName);

    try {
        // Use stdio: 'inherit' to allow interactive prompts
        execSync(command.replace(projectName, tempName), { stdio: 'inherit', cwd: parentDir });

        clack.log.info('');
        clack.log.step('Moving project files to current directory...');

        // Move contents from temp directory to current directory
        const files = fs.readdirSync(tempPath);
        for (const file of files) {
            const srcPath = path.join(tempPath, file);
            const destPath = path.join(cwd, file);

            // If destination exists, remove it first
            if (fs.existsSync(destPath)) {
                const stat = fs.statSync(destPath);
                if (stat.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(destPath);
                }
            }

            fs.renameSync(srcPath, destPath);
        }

        clack.log.success(`Created ${template} project`);
        return true;
    } catch (error) {
        clack.log.error(`Failed to create ${template} project`);
        clack.log.error(error instanceof Error ? error.message : String(error));
        return false;
    } finally {
        // Always clean up temp directory, even on error
        try {
            if (fs.existsSync(tempPath)) {
                clack.log.step('Cleaning up temporary files...');
                fs.rmSync(tempPath, { recursive: true, force: true });
            }
        } catch {
            clack.log.warn('Failed to clean up temporary directory at ' + tempPath);
            clack.log.warn('You may want to manually delete it');
        }
    }
}

async function main(): Promise<void> {
    console.clear();

    clack.intro(pc.bgCyan(pc.black(' Agentica Setup ')));

    const cwd = process.cwd();
    const pm = detectPackageManager();

    clack.log.info(`Detected package manager: ${pc.cyan(pm.name)}`);

    const pkgPath = path.join(cwd, 'package.json');
    let buildTool = detectBuildTool(cwd, pm);

    // If no package.json or build tool detected, offer to initialize a project
    if (!fs.existsSync(pkgPath) || !buildTool) {
        clack.log.warn('No TypeScript project detected in current directory');

        const initChoice = await clack.select({
            message: 'Would you like to initialize a project?',
            options: [
                { value: 'plain', label: 'Plain TypeScript', hint: 'Simple TS project with tsc' },
                { value: 'vite', label: 'Vite + React', hint: 'Modern React with Vite' },
                { value: 'next-app', label: 'Next.js', hint: 'React framework for production' },
                { value: 'react-app', label: 'Create React App', hint: 'Classic React setup' },
                { value: 'manual', label: 'Exit', hint: 'Initialize manually' },
            ],
        });

        if (clack.isCancel(initChoice)) {
            clack.cancel('Setup cancelled');
            process.exit(0);
        }

        if (initChoice === 'manual') {
            clack.outro(
                pc.yellow('Setup cancelled. Initialize your project first:\n\n') +
                    pc.dim('  Plain TypeScript:\n') +
                    pc.dim(`    ${pm.exec} tsc --init\n\n`) +
                    pc.dim('  Or use a framework:\n') +
                    pc.dim(`    ${pm.create('vite', 'my-app')}\n`) +
                    pc.dim(`    ${pm.create('next-app', 'my-app')}\n`)
            );
            process.exit(0);
        }

        // Initialize the project
        let success = false;
        if (initChoice === 'plain') {
            success = await initializePlainTypeScript(cwd, pm);
        } else {
            success = await initializeProjectFromTemplate(cwd, pm, initChoice as 'vite' | 'next-app' | 'react-app');
        }

        if (!success) {
            clack.outro(pc.red('✗ Failed to initialize project'));
            process.exit(1);
        }

        // Re-detect build tool after initialization
        buildTool = detectBuildTool(cwd, pm);

        if (!buildTool) {
            clack.outro(pc.red('✗ Could not detect build tool after initialization'));
            process.exit(1);
        }

        clack.log.success('Project initialized successfully!');
    }

    clack.log.info(`Detected build tool: ${pc.cyan(getBuildToolDisplayName(buildTool))}`);

    // Allow the user to override the detected build tool
    const confirmBuildTool = await clack.confirm({
        message: 'Is this the desired build tool for your project?',
        initialValue: true,
    });

    if (clack.isCancel(confirmBuildTool)) {
        clack.cancel('Setup cancelled');
        process.exit(0);
    }

    if (!confirmBuildTool) {
        const manualBuildTool = await clack.select({
            message: 'Select the build tool you want to configure',
            options: [
                { value: 'nextjs', label: 'Next.js' },
                { value: 'vite', label: 'Vite' },
                { value: 'webpack', label: 'Webpack' },
                { value: 'rollup', label: 'Rollup' },
                { value: 'esbuild', label: 'esbuild' },
                { value: 'bun', label: 'Bun' },
                { value: 'tsc', label: 'TypeScript CLI (ts-patch)' },
            ],
        });

        if (clack.isCancel(manualBuildTool)) {
            clack.cancel('Setup cancelled');
            process.exit(0);
        }

        buildTool = manualBuildTool as BuildTool;
        clack.log.info(`Using build tool: ${pc.cyan(getBuildToolDisplayName(buildTool))}`);
    }

    const alreadyConfigured = buildTool === 'tsc' ? isAlreadyConfigured(path.join(cwd, 'tsconfig.json')) : false;

    if (alreadyConfigured) {
        const reconfigure = await clack.confirm({
            message: 'Agentica appears to be already configured. Reconfigure?',
            initialValue: false,
        });

        if (clack.isCancel(reconfigure) || !reconfigure) {
            clack.outro(pc.yellow('Setup cancelled. No changes made.'));
            process.exit(0);
        }
    }

    const modeChoice = await clack.select({
        message: 'Choose installation mode',
        options: [
            { value: 'interactive', label: 'Interactive', hint: 'Confirm each step' },
            { value: 'automatic', label: 'Automatic', hint: 'Apply all changes' },
        ],
    });

    if (clack.isCancel(modeChoice)) {
        clack.cancel('Setup cancelled');
        process.exit(0);
    }

    const interactive = modeChoice === 'interactive';
    const context: SetupContext = {
        interactive,
        buildTool,
        cwd,
        packageManager: pm,
    };

    if (interactive) {
        const frameworkConfirm = await clack.confirm({
            message: `Configure ${getBuildToolDisplayName(buildTool)} with Agentica's code transformer?`,
            initialValue: true,
        });

        if (clack.isCancel(frameworkConfirm)) {
            clack.cancel('Setup cancelled');
            process.exit(0);
        }

        if (!frameworkConfirm) {
            clack.log.warn('Skipping framework configuration');
        } else {
            const success = await configureBuildTool(context);
            if (!success) {
                clack.log.error('Framework configuration failed. You may need to configure manually.');
            }
        }
    } else {
        const success = await configureBuildTool(context);
        if (!success) {
            clack.outro(pc.red('✗ Failed to configure build tool'));
            process.exit(1);
        }
    }

    // Ensure there's a useful hello-world entry point
    maybeWriteHelloWorldIndex(cwd);

    const existingTelemetry = getExistingTelemetrySetting(cwd);

    if (existingTelemetry !== null) {
        const changeTelemetry = await clack.confirm({
            message: `Telemetry is currently ${existingTelemetry ? 'enabled' : 'disabled'}. Change setting?`,
            initialValue: false,
        });

        if (!clack.isCancel(changeTelemetry) && changeTelemetry) {
            const telemetryChoice = await clack.confirm({
                message: 'Enable telemetry to help improve Agentica?',
                initialValue: existingTelemetry,
            });

            if (!clack.isCancel(telemetryChoice)) {
                updatePackageJsonConfig(cwd, telemetryChoice);
                clack.log.success(`Telemetry ${telemetryChoice ? 'enabled' : 'disabled'}`);
            }
        }
    } else {
        const telemetryChoice = await clack.confirm({
            message: 'Enable telemetry to help improve Agentica?',
            initialValue: false,
        });

        if (!clack.isCancel(telemetryChoice)) {
            updatePackageJsonConfig(cwd, telemetryChoice);
            clack.log.success(`Telemetry ${telemetryChoice ? 'enabled' : 'disabled'}`);
        }
    }

    const existingApiKey = getExistingApiKey(cwd, buildTool);
    const envFileName = getEnvFileName(buildTool);

    if (existingApiKey) {
        const maskedKey = existingApiKey.substring(0, 8) + '...';
        const changeApiKey = await clack.confirm({
            message: `API key already exists in ${envFileName} (${maskedKey}). Update it?`,
            initialValue: false,
        });

        if (!clack.isCancel(changeApiKey) && changeApiKey) {
            const apiKey = await clack.text({
                message: 'Enter your new Agentica API key',
                placeholder: 'sk_...',
                validate: (value: string) => {
                    if (!value || value.length === 0) return 'API key is required';
                },
            });

            if (!clack.isCancel(apiKey)) {
                addToEnvFile(cwd, envFileName, apiKey as string);
                clack.log.success(`API key updated in ${pc.cyan(envFileName)}`);
            }
        }
    } else {
        const apiKeyChoice = await clack.confirm({
            message: `Add AGENTICA_API_KEY to ${envFileName}?`,
            initialValue: false,
        });

        if (!clack.isCancel(apiKeyChoice) && apiKeyChoice) {
            const apiKey = await clack.text({
                message: 'Enter your Agentica API key',
                placeholder: 'sk_...',
                validate: (value: string) => {
                    if (!value || value.length === 0) return 'API key is required';
                },
            });

            if (!clack.isCancel(apiKey)) {
                addToEnvFile(cwd, envFileName, apiKey as string);
                clack.log.success(`API key saved to ${pc.cyan(envFileName)}`);
            }
        }
    }

    const spinner = clack.spinner();
    spinner.start('Installing dependencies');
    try {
        execSync(pm.install(), { stdio: 'pipe', cwd });
        spinner.stop('Dependencies installed ' + pc.green('✓'));
    } catch {
        spinner.stop('Failed to install dependencies ' + pc.red('✗'));
        clack.log.warn(`Run \`${pm.install()}\` manually to complete setup`);
    }

    if (buildTool === 'tsc') {
        const patchSpinner = clack.spinner();
        patchSpinner.start('Running ts-patch');
        try {
            execSync(`${pm.exec} ts-patch install -s`, { stdio: 'pipe', cwd });
            patchSpinner.stop('ts-patch configured ' + pc.green('✓'));
        } catch {
            patchSpinner.stop('Failed to run ts-patch ' + pc.red('✗'));
            clack.log.warn(`Run \`${pm.exec} ts-patch install -s\` manually`);
        }

        // Check for bundler mode if using Bun
        const tsconfigPath = path.join(cwd, 'tsconfig.json');
        if (pm.name === 'bun' && checkBundlerModeInTsConfig(tsconfigPath)) {
            warnAboutBundlerMode();
        }

        clack.log.info('');
        clack.log.info(pc.cyan('Important: ') + pc.bold('Use tspc instead of tsc to compile'));
        clack.log.step('  1. Compile: ' + pc.yellow(`${pm.exec} tspc`));
        clack.log.step('  2. Run:     ' + pc.yellow(`${pm.runtime} dist/index.js`));
        clack.log.info('');
        clack.log.warn(
            pc.dim('Note: Runtime tools like ') +
                pc.yellow('tsx') +
                pc.dim(' or ') +
                pc.yellow('ts-node') +
                pc.dim(' will not work\n      (transformations are skipped)')
        );
    } else if (buildTool === 'rollup') {
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Build: ' + pc.yellow(`${pm.exec} rollup -c`));
        clack.log.info('');
    } else if (buildTool === 'esbuild') {
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Build: ' + pc.yellow(`${pm.runtime} esbuild.config.ts`));
        clack.log.info('');
    } else if (buildTool === 'webpack') {
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Build: ' + pc.yellow(`${pm.exec} webpack`));
        clack.log.info('');
    } else if (buildTool === 'vite') {
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Dev:   ' + pc.yellow(`${pm.run('dev')}`));
        clack.log.step('  Build: ' + pc.yellow(`${pm.run('build')}`));
        clack.log.info('');
    } else if (buildTool === 'nextjs') {
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Dev:   ' + pc.yellow(`${pm.run('dev')}`));
        clack.log.step('  Build: ' + pc.yellow(`${pm.run('build')}`));
        clack.log.info('');
    } else if (buildTool === 'bun') {
        const entryPoint = getEntryPointPath(cwd);
        clack.log.info('');
        clack.log.info(pc.cyan('Next steps:'));
        clack.log.step('  Run: ' + pc.yellow(`bun run ${entryPoint}`));
        clack.log.info('');
    }

    clack.outro(pc.green('✓ Setup complete! Your project is ready to use Agentica.'));
}

main().catch((error) => {
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
