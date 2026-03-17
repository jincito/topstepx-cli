import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  external: ['@napi-rs/keyring', '@inquirer/input', '@inquirer/password', '@inquirer/confirm', '@microsoft/signalr'],
});
