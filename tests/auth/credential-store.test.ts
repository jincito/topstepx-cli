import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Mock getConfigDir and ensureConfigDir to use temp directory
vi.mock('../../src/config/paths.js', () => ({
  getConfigDir: vi.fn(),
  ensureConfigDir: vi.fn(),
}));

// Mock @napi-rs/keyring with an in-memory store
const keyringStore = new Map<string, string>();
let keyringAvailable = true;

vi.mock('@napi-rs/keyring', () => {
  return {
    Entry: class MockEntry {
      private service: string;
      private account: string;

      constructor(service: string, account: string) {
        if (!keyringAvailable) {
          throw new Error('No such interface "org.freedesktop.Secret.Service"');
        }
        this.service = service;
        this.account = account;
      }

      setPassword(password: string): void {
        if (!keyringAvailable) {
          throw new Error('No such interface "org.freedesktop.Secret.Service"');
        }
        keyringStore.set(`${this.service}:${this.account}`, password);
      }

      getPassword(): string | null {
        if (!keyringAvailable) {
          throw new Error('No such interface "org.freedesktop.Secret.Service"');
        }
        return keyringStore.get(`${this.service}:${this.account}`) ?? null;
      }

      deleteCredential(): boolean {
        if (!keyringAvailable) {
          throw new Error('No such interface "org.freedesktop.Secret.Service"');
        }
        return keyringStore.delete(`${this.service}:${this.account}`);
      }
    },
  };
});

// Mock os.hostname and os.userInfo for deterministic key derivation
vi.mock('node:os', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:os')>();
  return {
    ...original,
    hostname: vi.fn(() => 'test-host'),
    userInfo: vi.fn(() => ({
      username: 'test-user',
      uid: 1000,
      gid: 1000,
      shell: '/bin/bash',
      homedir: '/home/test-user',
    })),
  };
});

import { getConfigDir, ensureConfigDir } from '../../src/config/paths.js';
import { CredentialStore } from '../../src/auth/credential-store.js';
import type { StoredCredentials } from '../../src/auth/credential-store.js';

const mockedGetConfigDir = vi.mocked(getConfigDir);
const mockedEnsureConfigDir = vi.mocked(ensureConfigDir);

describe('CredentialStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'topstepx-cred-test-'));
    mockedGetConfigDir.mockReturnValue(tempDir);
    mockedEnsureConfigDir.mockReturnValue(tempDir);
    keyringStore.clear();
    keyringAvailable = true;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('probeKeyring', () => {
    it('detects keyring as available when Entry operations succeed', () => {
      const store = new CredentialStore();
      // If probeKeyring returned true, the store will use keyring mode.
      // We verify by saving and checking keyring store was used.
      const creds: StoredCredentials = { username: 'alice', apiKey: 'key-123' };
      store.save(creds);
      expect(keyringStore.has('topstepx-cli:alice')).toBe(true);
    });

    it('detects keyring as unavailable when Entry throws', () => {
      keyringAvailable = false;
      const store = new CredentialStore();
      // Store should fall back to file mode.
      // Re-enable keyring so save doesn't throw during file write
      keyringAvailable = true;
      const creds: StoredCredentials = { username: 'bob', apiKey: 'key-456' };
      // This should use file fallback since probeKeyring returned false
      store.save(creds);
      expect(keyringStore.has('topstepx-cli:bob')).toBe(false);
      expect(existsSync(join(tempDir, 'credentials.enc'))).toBe(true);
    });
  });

  describe('keyring mode', () => {
    it('save stores credentials in keyring', () => {
      const store = new CredentialStore();
      store.save({ username: 'alice', apiKey: 'secret-key' });
      expect(keyringStore.get('topstepx-cli:alice')).toBe('secret-key');
    });

    it('load retrieves credentials from keyring', () => {
      const store = new CredentialStore();
      store.save({ username: 'alice', apiKey: 'secret-key' });
      const loaded = store.load();
      expect(loaded).toEqual({ username: 'alice', apiKey: 'secret-key' });
    });

    it('clear removes credentials from keyring', () => {
      const store = new CredentialStore();
      store.save({ username: 'alice', apiKey: 'secret-key' });
      store.clear();
      expect(keyringStore.has('topstepx-cli:alice')).toBe(false);
    });

    it('load returns null when no credentials stored', () => {
      const store = new CredentialStore();
      const loaded = store.load();
      expect(loaded).toBeNull();
    });
  });

  describe('file fallback mode', () => {
    beforeEach(() => {
      keyringAvailable = false;
    });

    afterEach(() => {
      keyringAvailable = true;
    });

    it('save creates encrypted file at credentials.enc', () => {
      // probeKeyring fails, so constructor sets useKeyring = false
      const store = new CredentialStore();
      keyringAvailable = true; // re-enable so mock Entry doesn't throw during unrelated ops
      store.save({ username: 'charlie', apiKey: 'file-key' });
      expect(existsSync(join(tempDir, 'credentials.enc'))).toBe(true);
    });

    it('load decrypts and returns stored credentials', () => {
      const store = new CredentialStore();
      keyringAvailable = true;
      const creds: StoredCredentials = { username: 'charlie', apiKey: 'file-key' };
      store.save(creds);
      const loaded = store.load();
      expect(loaded).toEqual(creds);
    });

    it('load returns null when no encrypted file exists', () => {
      const store = new CredentialStore();
      keyringAvailable = true;
      const loaded = store.load();
      expect(loaded).toBeNull();
    });

    it('clear deletes the encrypted file', () => {
      const store = new CredentialStore();
      keyringAvailable = true;
      store.save({ username: 'charlie', apiKey: 'file-key' });
      expect(existsSync(join(tempDir, 'credentials.enc'))).toBe(true);
      store.clear();
      expect(existsSync(join(tempDir, 'credentials.enc'))).toBe(false);
    });

    it('generates fresh random IV each save (no IV reuse)', () => {
      const store = new CredentialStore();
      keyringAvailable = true;
      store.save({ username: 'charlie', apiKey: 'file-key' });
      const bytes1 = readFileSync(join(tempDir, 'credentials.enc'));

      store.save({ username: 'charlie', apiKey: 'file-key' });
      const bytes2 = readFileSync(join(tempDir, 'credentials.enc'));

      // Salt is first 32 bytes, IV is next 12 bytes
      // Both salt and IV should differ between writes (randomBytes)
      const saltIv1 = bytes1.subarray(0, 44); // 32 salt + 12 IV
      const saltIv2 = bytes2.subarray(0, 44);
      expect(Buffer.compare(saltIv1, saltIv2)).not.toBe(0);
    });
  });

  describe('clear safety', () => {
    it('does not throw when nothing to clear (keyring mode)', () => {
      const store = new CredentialStore();
      expect(() => store.clear()).not.toThrow();
    });

    it('does not throw when nothing to clear (file mode)', () => {
      keyringAvailable = false;
      const store = new CredentialStore();
      keyringAvailable = true;
      expect(() => store.clear()).not.toThrow();
    });
  });
});
