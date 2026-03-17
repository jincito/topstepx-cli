export { login, refreshToken, API_BASE_URL } from './client.js';
export type { LoginResponse, ValidateResponse } from './client.js';
export {
  decodeJwtPayload,
  isTokenExpiringSoon,
  saveToken,
  loadToken,
  clearToken,
  getTokenPath,
} from './token.js';
export type { JwtPayload, TokenCache } from './token.js';
export { CredentialStore } from './credential-store.js';
export type { StoredCredentials } from './credential-store.js';
export { promptCredentials } from './prompt.js';
export { ensureAuth } from './middleware.js';
