import { sendSmtpEmail } from '@/services/smtp-email-api';

describe('smtp email api', () => {
  const originalCustomerApiBaseUrl = process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL;
  const originalPublicApiKey = process.env.EXPO_PUBLIC_X_API_KEY;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL = 'http://localhost:3500';
    process.env.EXPO_PUBLIC_X_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_CUSTOMER_API_BASE_URL = originalCustomerApiBaseUrl;
    process.env.EXPO_PUBLIC_X_API_KEY = originalPublicApiKey;
  });

  it('posts smtp email notifications through the configured backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    await sendSmtpEmail({
      subject: 'Profile Update Notification',
      html: '<p>Hello</p>',
      to: ['support@insureprobuilders.com'],
      cc: ['manager@example.com'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3500/email/smtp/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      subject: 'Profile Update Notification',
      html: '<p>Hello</p>',
      to: ['support@insureprobuilders.com'],
      cc: ['manager@example.com'],
    });
  });
});
