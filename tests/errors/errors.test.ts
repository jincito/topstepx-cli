import {
  CliError,
  ApiError,
  AuthError,
  ValidationError,
  NetworkError,
  type ErrorContext,
} from '../../src/errors/index.js';

describe('CliError base class', () => {
  it('is abstract and cannot be instantiated directly', () => {
    // CliError is abstract, so we verify it only works through subclasses
    // TypeScript prevents direct instantiation at compile time;
    // at runtime we verify the subclass chain works correctly
    const err = new ApiError('test', 500);
    expect(err).toBeInstanceOf(CliError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ApiError', () => {
  it('creates an instance with correct properties', () => {
    const err = new ApiError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('API_ERROR');
    expect(err.errorCode).toBe(404);
    expect(err.name).toBe('ApiError');
  });

  it('instanceof checks work through the full chain', () => {
    const err = new ApiError('Not found', 404);
    expect(err instanceof ApiError).toBe(true);
    expect(err instanceof CliError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('toJSON() returns structured object with errorCode in context', () => {
    const err = new ApiError('Not found', 404);
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'API_ERROR',
      message: 'Not found',
      context: { errorCode: 404 },
    });
  });

  it('merges additional context with errorCode', () => {
    const err = new ApiError('Server error', 500, { endpoint: '/accounts' });
    const json = err.toJSON();
    expect(json.context).toEqual({
      errorCode: 500,
      endpoint: '/accounts',
    });
  });

  it('defaults context to empty object when not provided (aside from errorCode)', () => {
    const err = new ApiError('Error', 400);
    expect(err.toJSON().context).toEqual({ errorCode: 400 });
  });
});

describe('AuthError', () => {
  it('creates an instance with correct properties', () => {
    const err = new AuthError('Token expired');
    expect(err.message).toBe('Token expired');
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.name).toBe('AuthError');
  });

  it('instanceof checks work through the full chain', () => {
    const err = new AuthError('Token expired');
    expect(err instanceof AuthError).toBe(true);
    expect(err instanceof CliError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('toJSON() returns structured object', () => {
    const err = new AuthError('Token expired');
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'AUTH_ERROR',
      message: 'Token expired',
      context: {},
    });
  });

  it('preserves context fields', () => {
    const err = new AuthError('Token expired', { tokenAge: '24h' });
    expect(err.toJSON().context).toEqual({ tokenAge: '24h' });
  });

  it('defaults context to empty object when not provided', () => {
    const err = new AuthError('Unauthorized');
    expect(err.toJSON().context).toEqual({});
  });
});

describe('ValidationError', () => {
  it('creates an instance with correct properties', () => {
    const err = new ValidationError('Invalid symbol', { field: 'symbol', value: 'ZZ' });
    expect(err.message).toBe('Invalid symbol');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
  });

  it('instanceof checks work through the full chain', () => {
    const err = new ValidationError('Invalid symbol', { field: 'symbol' });
    expect(err instanceof ValidationError).toBe(true);
    expect(err instanceof CliError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('toJSON() returns structured object', () => {
    const err = new ValidationError('Invalid symbol', { field: 'symbol', value: 'ZZ' });
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid symbol',
      context: { field: 'symbol', value: 'ZZ' },
    });
  });

  it('stores field as a convenience property', () => {
    const err = new ValidationError('Invalid symbol', { field: 'symbol' });
    expect(err.field).toBe('symbol');
  });

  it('field is undefined when not provided in context', () => {
    const err = new ValidationError('Invalid input');
    expect(err.field).toBeUndefined();
  });

  it('defaults context to empty object when not provided', () => {
    const err = new ValidationError('Invalid input');
    expect(err.toJSON().context).toEqual({});
  });
});

describe('NetworkError', () => {
  it('creates an instance with correct properties', () => {
    const err = new NetworkError('Connection refused', { url: 'https://api.topstepx.com' });
    expect(err.message).toBe('Connection refused');
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.name).toBe('NetworkError');
  });

  it('instanceof checks work through the full chain', () => {
    const err = new NetworkError('Connection refused');
    expect(err instanceof NetworkError).toBe(true);
    expect(err instanceof CliError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('toJSON() returns structured object', () => {
    const err = new NetworkError('Connection refused', { url: 'https://api.topstepx.com' });
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Connection refused',
      context: { url: 'https://api.topstepx.com' },
    });
  });

  it('preserves multiple context fields', () => {
    const err = new NetworkError('Timeout', { url: 'https://api.topstepx.com', timeout: 5000 });
    expect(err.toJSON().context).toEqual({
      url: 'https://api.topstepx.com',
      timeout: 5000,
    });
  });

  it('defaults context to empty object when not provided', () => {
    const err = new NetworkError('Connection refused');
    expect(err.toJSON().context).toEqual({});
  });
});

describe('Error hierarchy cross-cutting concerns', () => {
  it('all subclasses have distinct code prefixes', () => {
    const codes = [
      new ApiError('test', 500).code,
      new AuthError('test').code,
      new ValidationError('test').code,
      new NetworkError('test').code,
    ];
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(4);
    expect(codes).toEqual(['API_ERROR', 'AUTH_ERROR', 'VALIDATION_ERROR', 'NETWORK_ERROR']);
  });

  it('all subclasses have name matching class name', () => {
    expect(new ApiError('test', 500).name).toBe('ApiError');
    expect(new AuthError('test').name).toBe('AuthError');
    expect(new ValidationError('test').name).toBe('ValidationError');
    expect(new NetworkError('test').name).toBe('NetworkError');
  });

  it('all subclasses are throwable and catchable', () => {
    expect(() => { throw new ApiError('fail', 500); }).toThrow('fail');
    expect(() => { throw new AuthError('fail'); }).toThrow('fail');
    expect(() => { throw new ValidationError('fail'); }).toThrow('fail');
    expect(() => { throw new NetworkError('fail'); }).toThrow('fail');
  });

  it('all subclasses produce valid stack traces', () => {
    const err = new ApiError('test', 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ApiError');
  });
});
