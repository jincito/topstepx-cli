import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function getVersion(): string {
  try {
    // In bundled CJS output, __dirname is dist/. package.json is one level up.
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const version = getVersion();
