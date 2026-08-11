const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockGetUser = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
const mockGetSupabaseClient = jest.fn(() => ({
  auth: { getUser: mockGetUser },
  from: mockFrom,
}));
let mockIsDevice = true;

jest.mock('@/services/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
    easConfig: null,
  },
}));

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
}));

const {
  configureForegroundNotificationHandling,
  registerForPushNotifications,
  savePushDeviceToken,
} = require('@/services/push-notifications') as typeof import('@/services/push-notifications');

describe('push notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDevice = true;
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'Customer@Example.com' } },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('registers an authorized physical iPhone with the configured EAS project', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, ios: { status: 2 } });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });

    await expect(registerForPushNotifications()).resolves.toEqual({
      status: 'registered',
      message: 'Ready. Copy this token into the Expo Push Notification Tool.',
      token: 'ExponentPushToken[test-token]',
    });
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
  });

  it('requests permission and returns a helpful denied state', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 0 } });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 1 } });

    const result = await registerForPushNotifications();

    expect(result.status).toBe('permission-denied');
    expect(result.message).toContain('iPhone Settings');
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('does not attempt registration on an iOS simulator', async () => {
    mockIsDevice = false;

    const result = await registerForPushNotifications();

    expect(result.status).toBe('simulator');
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });

  it('configures visible foreground notifications', () => {
    configureForegroundNotificationHandling();

    expect(mockSetNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
  });

  it('upserts the Expo token for the authenticated Supabase user', async () => {
    await savePushDeviceToken('  ExponentPushToken[test-token]  ');

    expect(mockFrom).toHaveBeenCalledWith('portal_push_devices');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        login_email: 'customer@example.com',
        expo_push_token: 'ExponentPushToken[test-token]',
        platform: 'ios',
        project_id: 'test-project-id',
        is_active: true,
      }),
      { onConflict: 'user_id,expo_push_token' }
    );
  });

  it('does not save a token without an authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(savePushDeviceToken('ExponentPushToken[test-token]')).rejects.toThrow(
      'Sign in before saving'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('reports database failures while saving a token', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'relation does not exist' } });

    await expect(savePushDeviceToken('ExponentPushToken[test-token]')).rejects.toThrow(
      'relation does not exist'
    );
  });
});
