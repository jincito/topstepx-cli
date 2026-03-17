import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

const CONFIG_DIR_NAME = 'topstepx';

/** Returns the XDG-style config directory path: ~/.config/topstepx */
export function getConfigDir(): string {
  return join(homedir(), '.config', CONFIG_DIR_NAME);
}

/** Creates the config directory if it does not exist. Returns the path. */
export function ensureConfigDir(): string {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}
