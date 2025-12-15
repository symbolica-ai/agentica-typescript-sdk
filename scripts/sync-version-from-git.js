#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function getVersionFromGit(mode, suffix) {
  const envVersion = process.env.SETUPTOOLS_SCM_PRETEND_VERSION;
  if (envVersion) {
    console.log(`Using version from SETUPTOOLS_SCM_PRETEND_VERSION: ${envVersion}`);
    return envVersion;
  }

  try {
    // Use local get-version.sh (symlink in monorepo, actual file in public SDK)
    const versionScript = join(__dirname, 'get-version.sh');
    let cmd = `${versionScript} ${mode} typescript`;
    if (mode === 'prod' && suffix) {
      cmd += ` ${suffix}`;
    }

    const version = execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    }).trim();
    return version;
  } catch (error) {
    console.error('Failed to get version from git:', error.message);
    console.error('Set SETUPTOOLS_SCM_PRETEND_VERSION environment variable to provide version in Docker/CI');
    return '0.0.0-unknown';
  }
}

const mode = process.argv[2] || 'prev';
const suffix = process.argv[3] || process.env.RELEASE_SUFFIX || 'rc';

if (mode === 'prod' && !suffix) {
  console.error('Error: prod mode requires a suffix argument');
  console.error('Usage: node sync-version-from-git.js prod [suffix]');
  console.error('   or: node sync-version-from-git.js prev');
  console.error('   or: node sync-version-from-git.js dev');
  process.exit(1);
}

const version = getVersionFromGit(mode, suffix);

// Write version.ts
const versionFile = join(rootDir, 'src', 'version.ts');
const content = `// This file is auto-generated from git tags
// Do not edit manually
export const version = "${version}";
`;
writeFileSync(versionFile, content, 'utf-8');

// Update package.json with version from get-version.sh
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
packageJson.version = version;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n', 'utf-8');

console.log(`Version synced from git: ${version}`);
