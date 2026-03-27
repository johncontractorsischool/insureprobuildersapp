import { syncCslbMomentum } from '@/services/cslb-momentum-sync-api';

function mockResponse({
  ok,
  status,
  body,
}: {
  ok: boolean;
  status: number;
  body: unknown;
}) {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('syncCslbMomentum', () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.EXPO_PUBLIC_CSLB_MOMENTUM_API_BASE_URL;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EXPO_PUBLIC_CSLB_MOMENTUM_API_BASE_URL = 'http://localhost:3500';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_CSLB_MOMENTUM_API_BASE_URL = originalBaseUrl;
  });

  it('returns parsed sync result on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          ok: true,
          result: {
            status: 'existing',
            message: 'Already exists.',
            cslb: { licenseNumber: '1105382' },
            momentum: { id: 'm-1' },
          },
        },
      })
    );

    const response = await syncCslbMomentum({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      licenseNumber: '1105382',
      appFeeNumber: '',
      agentName: 'John McCants',
    });

    expect(response.ok).toBe(true);
    expect(response.result.status).toBe('existing');
    expect(response.result.message).toBe('Already exists.');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3500/api/cslb-momentum/sync',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('throws API message when backend returns ok: false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          ok: false,
          error: 'CSLB lookup failed.',
        },
      })
    );

    await expect(
      syncCslbMomentum({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        licenseNumber: '1105382',
        appFeeNumber: '',
        agentName: '',
      })
    ).rejects.toThrow('CSLB lookup failed.');
  });

  it('throws HTTP error message for non-2xx responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        ok: false,
        status: 500,
        body: {
          error: 'Internal server error.',
        },
      })
    );

    await expect(
      syncCslbMomentum({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        licenseNumber: '1105382',
        appFeeNumber: '',
        agentName: '',
      })
    ).rejects.toThrow('Internal server error.');
  });
});
