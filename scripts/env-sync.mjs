import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootEnvFile = path.join(rootDir, '.env.local');
const webEnvFile = path.join(rootDir, 'apps', 'web', '.env.local');
const rootExampleFile = path.join(rootDir, '.env.example');
const webExampleFile = path.join(rootDir, 'apps', 'web', '.env.example');

const isCheck = process.argv.includes('--check');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

if (isCheck) {
  console.log('[env:check] Validating .env synchronization between root and apps/web...');
  let hasError = false;

  if (!fs.existsSync(rootEnvFile)) {
    console.error(`[env:check] ❌ Root .env.local not found at: ${rootEnvFile}`);
    hasError = true;
  }

  if (!fs.existsSync(webEnvFile)) {
    console.error(`[env:check] ❌ Web .env.local not found at: ${webEnvFile}`);
    hasError = true;
  }

  if (!hasError) {
    const rootContent = fs.readFileSync(rootEnvFile, 'utf8');
    const webContent = fs.readFileSync(webEnvFile, 'utf8');

    if (rootContent === webContent) {
      console.log('[env:check] ✅ Root and apps/web .env.local are in sync.');
    } else {
      console.error('[env:check] ❌ Mismatch detected between root .env.local and apps/web/.env.local!');
      console.error('[env:check] Run "pnpm env:sync" to synchronize them.');
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  }
} else {
  console.log('[env:sync] Synchronizing environment configuration...');

  if (!fs.existsSync(rootEnvFile)) {
    if (fs.existsSync(webEnvFile)) {
      console.log(`[env:sync] Found apps/web/.env.local, copying to root: ${rootEnvFile}`);
      ensureDir(rootEnvFile);
      fs.copyFileSync(webEnvFile, rootEnvFile);
    } else {
      console.warn(`[env:sync] ⚠️ No .env.local found at root or apps/web. Creating from .env.example...`);
      if (fs.existsSync(rootExampleFile)) {
        fs.copyFileSync(rootExampleFile, rootEnvFile);
      }
    }
  }

  if (fs.existsSync(rootEnvFile)) {
    ensureDir(webEnvFile);
    fs.copyFileSync(rootEnvFile, webEnvFile);
    console.log(`[env:sync] ✅ Copied .env.local -> apps/web/.env.local`);
  }

  if (fs.existsSync(rootExampleFile)) {
    ensureDir(webExampleFile);
    fs.copyFileSync(rootExampleFile, webExampleFile);
    console.log(`[env:sync] ✅ Copied .env.example -> apps/web/.env.example`);
  }

  console.log('[env:sync] Environment files successfully synchronized.');
}
