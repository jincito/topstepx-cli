import { Entry } from '@napi-rs/keyring';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname, userInfo } from 'node:os';
import { getConfigDir, ensureConfigDir } from '../config/paths.js';

const SERVICE_NAME = 'topstepx-cli';
const CREDENTIAL_FILE = 'credentials.enc';
const USERNAME_FILE = 'username';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const SCRYPT_COST = 16384;

/** Credentials persisted for CLI authentication */
export interface StoredCredentials {
  username: string;
  apiKey: string;
}

/**
 * Credential store with OS keychain primary and AES-256-GCM encrypted file fallback.
 *
 * On construction, probes whether the OS keyring is available (it may not be
 * on headless Linux without a D-Bus Secret Service). If unavailable, all
 * operations use an encrypted file at ~/.config/topstepx/credentials.enc.
 */
export class CredentialStore {
  private readonly useKeyring: boolean;

  constructor() {
    this.useKeyring = CredentialStore.probeKeyring();
  }

  /**
   * Test whether the OS keyring is functional by writing and deleting a probe entry.
   * Returns false on headless Linux or other environments without a secret service.
   */
  private static probeKeyring(): boolean {
    try {
      const probe = new Entry(SERVICE_NAME, '__probe__');
      probe.setPassword('test');
      probe.deleteCredential();
      return true;
    } catch {
      return false;
    }
  }

  /** Save credentials to keyring or encrypted file */
  save(creds: StoredCredentials): void {
    if (this.useKeyring) {
      const entry = new Entry(SERVICE_NAME, creds.username);
      entry.setPassword(creds.apiKey);
      // Also persist username so we know which account to look up on load
      this.saveUsername(creds.username);
    } else {
      this.encryptToFile(creds);
    }
  }

  /** Load credentials from keyring or encrypted file. Returns null if none stored. */
  load(): StoredCredentials | null {
    if (this.useKeyring) {
      return this.loadFromKeyring();
    }
    return this.decryptFromFile();
  }

  /** Clear all stored credentials from keyring and/or file */
  clear(): void {
    if (this.useKeyring) {
      this.clearKeyring();
    }
    this.clearFile();
  }

  // ---------- Keyring helpers ----------

  private loadFromKeyring(): StoredCredentials | null {
    const username = this.loadUsername();
    if (!username) {
      return null;
    }
    try {
      const entry = new Entry(SERVICE_NAME, username);
      const apiKey = entry.getPassword();
      if (!apiKey) {
        return null;
      }
      return { username, apiKey };
    } catch {
      return null;
    }
  }

  private clearKeyring(): void {
    const username = this.loadUsername();
    if (username) {
      try {
        const entry = new Entry(SERVICE_NAME, username);
        entry.deleteCredential();
      } catch {
        // Ignore - entry may not exist
      }
    }
    // Remove username file
    try {
      unlinkSync(this.getUsernamePath());
    } catch {
      // Ignore
    }
  }

  private saveUsername(username: string): void {
    ensureConfigDir();
    writeFileSync(this.getUsernamePath(), username, { mode: 0o600 });
  }

  private loadUsername(): string | null {
    try {
      return readFileSync(this.getUsernamePath(), 'utf-8').trim();
    } catch {
      return null;
    }
  }

  private getUsernamePath(): string {
    return join(getConfigDir(), USERNAME_FILE);
  }

  // ---------- Encrypted file helpers ----------

  private getMachineId(): string {
    return hostname() + ':' + userInfo().username;
  }

  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.getMachineId(), salt, KEY_LENGTH, {
      N: SCRYPT_COST,
    }) as Buffer;
  }

  private getCredentialFilePath(): string {
    return join(getConfigDir(), CREDENTIAL_FILE);
  }

  private encryptToFile(creds: StoredCredentials): void {
    ensureConfigDir();
    const plaintext = JSON.stringify(creds);
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = this.deriveKey(salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Format: [salt(32)][iv(12)][tag(16)][ciphertext(...)]
    const output = Buffer.concat([salt, iv, tag, encrypted]);
    writeFileSync(this.getCredentialFilePath(), output, { mode: 0o600 });
  }

  private decryptFromFile(): StoredCredentials | null {
    const filePath = this.getCredentialFilePath();
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = readFileSync(filePath);
      const salt = data.subarray(0, SALT_LENGTH);
      const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = data.subarray(
        SALT_LENGTH + IV_LENGTH,
        SALT_LENGTH + IV_LENGTH + TAG_LENGTH,
      );
      const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

      const key = this.deriveKey(salt);
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      const decrypted =
        decipher.update(encrypted).toString('utf-8') +
        decipher.final('utf-8');

      return JSON.parse(decrypted) as StoredCredentials;
    } catch {
      return null;
    }
  }

  private clearFile(): void {
    try {
      unlinkSync(this.getCredentialFilePath());
    } catch {
      // Ignore - file may not exist
    }
  }
}
