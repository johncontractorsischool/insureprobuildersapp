describe('getPortalConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('normalizes blank values to null and keeps valid http urls', () => {
    process.env.EXPO_PUBLIC_AGENT_NAME = '  Senior Agent  ';
    process.env.EXPO_PUBLIC_AGENT_PHONE = ' 5551112222 ';
    process.env.EXPO_PUBLIC_AGENT_EMAIL = ' agent@example.com ';
    process.env.EXPO_PUBLIC_AGENT_SMS_PHONE = ' 5559990000 ';
    process.env.EXPO_PUBLIC_AGENT_SCHEDULE_URL = 'https://calendar.example.com/agent';
    process.env.EXPO_PUBLIC_COMPANY_LICENSE_NUMBER = ' LIC-123 ';
    process.env.EXPO_PUBLIC_COMPANY_CSLB_URL = 'https://cslb.ca.gov/license';
    process.env.EXPO_PUBLIC_INTAKE_FORMS_URL = 'javascript:alert(1)';
    process.env.EXPO_PUBLIC_ISSUE_COI_URL = 'https://portal.example.com/coi';

    const { getPortalConfig } = require('@/services/portal-config');
    expect(getPortalConfig()).toEqual({
      agent: {
        name: 'Senior Agent',
        phone: '5551112222',
        email: 'agent@example.com',
        smsPhone: '5559990000',
        scheduleUrl: 'https://calendar.example.com/agent',
      },
      company: {
        licenseNumber: 'LIC-123',
        cslbUrl: 'https://cslb.ca.gov/license',
      },
      actions: {
        intakeFormsUrl: null,
        issueCoiUrl: 'https://portal.example.com/coi',
        supportEmail: 'support@insureprobuilders.com',
      },
    });
  });

  it('falls back to the default agent label when not configured', () => {
    delete process.env.EXPO_PUBLIC_AGENT_NAME;

    const { getPortalConfig } = require('@/services/portal-config');
    expect(getPortalConfig().agent.name).toBe('Assigned agent');
  });
});
