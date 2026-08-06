import { fetchClientAgent } from '@/services/agent-api';
import { createClientSignup } from '@/services/client-signup-api';
import { createClientContactRequest } from '@/services/contact-request-api';

const mockGetSession = jest.fn();

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () => mockGetSession(),
    },
  }),
}));

describe('PBIA client portal write and agent routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EXPO_PUBLIC_PBIA_API_BASE_URL = 'http://localhost:3000';
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-token',
          user: { email: 'jane@example.com' },
        },
      },
      error: null,
    });
  });

  it('loads the email-scoped assigned agent', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'agent-1',
        firstName: 'Pat',
        lastName: 'Agent',
        email: 'pat@example.com',
        phone: '5553334444',
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchClientAgent('jane@example.com', 'account-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/agent?accountId=account-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-token',
        }),
      })
    );
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Client-Email');
  });

  it('submits signup with its stable idempotency key', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'signup-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createClientSignup(
      {
        legalName: 'Builder Co',
        email: 'jane@example.com',
        status: 'PROSPECT',
        licenseNumber: '1144038',
        primaryContactFirstName: 'Jane',
        primaryContactLastName: 'Builder',
        addressLine1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
      },
      'signup-intent-1'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/signup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'signup-intent-1' }),
      })
    );
  });

  it('submits an email-scoped contact request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'request-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createClientContactRequest(
      'jane@example.com',
      {
        accountId: 'account-1',
        callbackNumber: '5551112222',
        preferredContactMethod: 'EMAIL',
        description: 'Please call me.',
      },
      'contact-intent-1'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/client/contact-requests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'contact-intent-1' }),
        body: JSON.stringify({
          accountId: 'account-1',
          callbackNumber: '5551112222',
          preferredContactMethod: 'EMAIL',
          description: 'Please call me.',
        }),
      })
    );
  });

  it('does not call PBIA without an authenticated Supabase session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(fetchClientAgent('jane@example.com', 'account-1')).rejects.toMatchObject({
      status: 401,
      message: 'Your secure sign-in session is unavailable. Please sign in again.',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
