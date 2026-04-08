import { withApiKeyHeader } from '@/services/api-request-headers';

describe('withApiKeyHeader', () => {
  const originalApiKey = process.env.EXPO_PUBLIC_X_API_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_X_API_KEY = originalApiKey;
  });

  it('adds x-api-key when EXPO_PUBLIC_X_API_KEY is set', () => {
    process.env.EXPO_PUBLIC_X_API_KEY = 'test-key';

    const headers = withApiKeyHeader({ Accept: 'application/json' });

    expect(headers).toEqual({
      Accept: 'application/json',
      'x-api-key': 'test-key',
    });
  });

  it('does not add x-api-key when EXPO_PUBLIC_X_API_KEY is missing', () => {
    delete process.env.EXPO_PUBLIC_X_API_KEY;

    const headers = withApiKeyHeader({ Accept: 'application/json' });

    expect(headers).toEqual({ Accept: 'application/json' });
  });
});
