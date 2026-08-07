import { normalizeApiBaseUrlForRuntime, resolveApiBaseUrl } from '@/services/api-base-url';

describe('api base URL helpers', () => {
  it('routes localhost through the Android emulator host alias', () => {
    expect(normalizeApiBaseUrlForRuntime('http://localhost:3500', 'android')).toBe('http://10.0.2.2:3500');
    expect(normalizeApiBaseUrlForRuntime('http://127.0.0.1:3500/api/', 'android')).toBe(
      'http://10.0.2.2:3500/api'
    );
  });

  it('keeps localhost unchanged outside Android', () => {
    expect(normalizeApiBaseUrlForRuntime('http://localhost:3500', 'ios')).toBe('http://localhost:3500');
    expect(normalizeApiBaseUrlForRuntime('http://localhost:3500', 'web')).toBe('http://localhost:3500');
  });

  it('uses the first non-empty candidate', () => {
    expect(resolveApiBaseUrl('', '  ', 'https://api.example.com/')).toBe('https://api.example.com');
  });
});
