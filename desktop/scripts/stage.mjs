// Builds the frontend and backend and assembles desktop/app: the self-contained
// folder electron-builder packages (and `electron app` can run directly).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(desktop, '..');
const frontend = path.join(root, 'frontend');
const backend = path.join(root, 'backend');
const app = path.join(desktop, 'app');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const ensureDeps = (dir) => { if (!fs.existsSync(path.join(dir, 'node_modules'))) run('npm ci', dir); };

ensureDeps(frontend);
ensureDeps(backend);
run('npm run build', frontend);
run('npm run build', backend);

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
fs.cpSync(path.join(frontend, 'dist'), path.join(app, 'web'), { recursive: true });
fs.cpSync(path.join(backend, 'dist'), path.join(app, 'server'), { recursive: true });
fs.writeFileSync(path.join(app, 'server', 'package.json'), '{ "type": "module" }\n');
for (const f of ['main.cjs', 'preload.cjs']) fs.copyFileSync(path.join(desktop, 'shell', f), path.join(app, f));
fs.copyFileSync(path.join(desktop, 'build', 'icon.png'), path.join(app, 'icon.png'));

// The app's package.json is the backend's (same dependencies, same lockfile) plus Electron metadata.
const backendPkg = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'));
const desktopPkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));
const pkg = {
  ...backendPkg,
  name: 'sonora',
  productName: 'Sonora',
  version: desktopPkg.version,
  description: 'Sonora: play the music in a folder, with synced lyrics',
  author: 'Sonora',
  license: 'MIT',
  main: 'main.cjs',
  scripts: undefined,
  type: undefined,
};
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.copyFileSync(path.join(backend, 'package-lock.json'), path.join(app, 'package-lock.json'));
run('npm ci --omit=dev', app);
console.log(`\nStaged ${app}`);
