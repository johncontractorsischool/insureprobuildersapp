import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendPbiaWebViewDiagnostic,
  clearPbiaWebViewDiagnostics,
  listPbiaWebViewDiagnostics,
  recoverPbiaWebViewSessionAfterRestart,
  startPbiaWebViewSession,
} from '@/services/pbia-webview-diagnostics';

describe('pbia webview diagnostics', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and returns diagnostics in reverse chronological order', async () => {
    await appendPbiaWebViewDiagnostic({ event: 'first-event' });
    await appendPbiaWebViewDiagnostic({ event: 'second-event', level: 'warn' });

    const diagnostics = await listPbiaWebViewDiagnostics();

    expect(diagnostics.map((entry) => entry.event)).toEqual(['second-event', 'first-event']);
    expect(diagnostics[0].level).toBe('warn');
  });

  it('recovers an interrupted embedded session after restart', async () => {
    const session = await startPbiaWebViewSession('contact', 'https://pbia-form-app.vercel.app/forms/contact');

    const recovered = await recoverPbiaWebViewSessionAfterRestart();
    const diagnostics = await listPbiaWebViewDiagnostics();

    expect(recovered?.sessionId).toBe(session.sessionId);
    expect(diagnostics.some((entry) => entry.event === 'previous-embedded-session-recovered-after-app-restart')).toBe(
      true
    );
  });

  it('clears the diagnostic history', async () => {
    await appendPbiaWebViewDiagnostic({ event: 'event-to-clear' });
    await clearPbiaWebViewDiagnostics();

    expect(await listPbiaWebViewDiagnostics()).toEqual([]);
  });
});
