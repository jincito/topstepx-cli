import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock objects exposed for test assertions
const mockConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  invoke: vi.fn().mockResolvedValue(undefined),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
};

const mockBuilder = {
  withUrl: vi.fn().mockReturnThis(),
  withAutomaticReconnect: vi.fn().mockReturnThis(),
  configureLogging: vi.fn().mockReturnThis(),
  build: vi.fn().mockReturnValue(mockConnection),
};

// Mock @microsoft/signalr before importing the module under test
vi.mock('@microsoft/signalr', () => {
  class MockHubConnectionBuilder {
    withUrl(...args: unknown[]) { return mockBuilder.withUrl(...args); }
    withAutomaticReconnect(...args: unknown[]) { return mockBuilder.withAutomaticReconnect(...args); }
    configureLogging(...args: unknown[]) { return mockBuilder.configureLogging(...args); }
    build(...args: unknown[]) { return mockBuilder.build(...args); }
  }

  return {
    HubConnectionBuilder: MockHubConnectionBuilder,
    HttpTransportType: { WebSockets: 1 },
    LogLevel: { Warning: 3 },
  };
});

import { createPersistentUserHub } from '../../src/services/user-hub.js';
import * as signalr from '@microsoft/signalr';

describe('createPersistentUserHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder.withUrl.mockReturnThis();
    mockBuilder.withAutomaticReconnect.mockReturnThis();
    mockBuilder.configureLogging.mockReturnThis();
    mockBuilder.build.mockReturnValue(mockConnection);
  });

  it('creates a HubConnection with the User Hub URL', () => {
    createPersistentUserHub({ token: 'test-token' });

    expect(mockBuilder.withUrl).toHaveBeenCalledWith(
      'https://rtc.topstepx.com/hubs/user',
      expect.objectContaining({
        skipNegotiation: true,
        transport: signalr.HttpTransportType.WebSockets,
      }),
    );
  });

  it('calls withAutomaticReconnect with retry delays [0, 2000, 5000, 10000, 30000]', () => {
    createPersistentUserHub({ token: 'test-token' });

    expect(mockBuilder.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 5000, 10000, 30000]);
  });

  it('uses mutable tokenHolder.token in accessTokenFactory (not a captured string)', () => {
    const tokenHolder = { token: 'initial-token' };
    createPersistentUserHub(tokenHolder);

    const urlOptions = mockBuilder.withUrl.mock.calls[0][1] as { accessTokenFactory: () => string };
    expect(urlOptions.accessTokenFactory()).toBe('initial-token');

    // Mutate the token holder
    tokenHolder.token = 'refreshed-token';
    expect(urlOptions.accessTokenFactory()).toBe('refreshed-token');
  });

  it('configures logging at Warning level', () => {
    createPersistentUserHub({ token: 'test-token' });

    expect(mockBuilder.configureLogging).toHaveBeenCalledWith(signalr.LogLevel.Warning);
  });

  it('returns the built HubConnection object', () => {
    const result = createPersistentUserHub({ token: 'test-token' });

    expect(mockBuilder.build).toHaveBeenCalled();
    expect(result).toBe(mockConnection);
  });
});
