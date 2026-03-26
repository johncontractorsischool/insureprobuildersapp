import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DIAGNOSTICS_STORAGE_KEY = 'pbia-webview-diagnostics-v1';
const ACTIVE_SESSION_STORAGE_KEY = 'pbia-webview-active-session-v1';
const MAX_DIAGNOSTIC_ENTRIES = 120;
const MAX_DETAIL_LENGTH = 420;

export type PbiaWebViewDiagnosticLevel = 'info' | 'warn' | 'error';

export type PbiaWebViewDiagnosticEntry = {
  id: string;
  timestamp: string;
  platform: string;
  level: PbiaWebViewDiagnosticLevel;
  event: string;
  formSlug?: string;
  sessionId?: string;
  details?: string;
};

export type PbiaWebViewActiveSession = {
  sessionId: string;
  startedAt: string;
  formSlug: string;
  initialUrl: string;
};

type AppendDiagnosticOptions = {
  event: string;
  details?: unknown;
  level?: PbiaWebViewDiagnosticLevel;
  formSlug?: string;
  sessionId?: string;
};

let writeQueue: Promise<void> = Promise.resolve();

function queueWrite(task: () => Promise<void>) {
  writeQueue = writeQueue.then(task).catch(() => undefined);
  return writeQueue;
}

function toDetailString(details: unknown) {
  if (details == null) return undefined;

  const raw =
    typeof details === 'string'
      ? details
      : (() => {
          try {
            return JSON.stringify(details);
          } catch {
            return String(details);
          }
        })();

  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  if (compact.length <= MAX_DETAIL_LENGTH) return compact;
  return `${compact.slice(0, MAX_DETAIL_LENGTH)}...`;
}

function safeParseDiagnostics(raw: string | null) {
  if (!raw) return [] as PbiaWebViewDiagnosticEntry[];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as PbiaWebViewDiagnosticEntry[];

    return parsed.filter((entry): entry is PbiaWebViewDiagnosticEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<PbiaWebViewDiagnosticEntry>;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.timestamp === 'string' &&
        typeof candidate.event === 'string' &&
        typeof candidate.level === 'string'
      );
    });
  } catch {
    return [] as PbiaWebViewDiagnosticEntry[];
  }
}

function safeParseActiveSession(raw: string | null): PbiaWebViewActiveSession | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<PbiaWebViewActiveSession>;
    if (
      typeof candidate.sessionId !== 'string' ||
      typeof candidate.startedAt !== 'string' ||
      typeof candidate.formSlug !== 'string' ||
      typeof candidate.initialUrl !== 'string'
    ) {
      return null;
    }

    return {
      sessionId: candidate.sessionId,
      startedAt: candidate.startedAt,
      formSlug: candidate.formSlug,
      initialUrl: candidate.initialUrl,
    };
  } catch {
    return null;
  }
}

async function readDiagnostics() {
  const raw = await AsyncStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
  return safeParseDiagnostics(raw);
}

export async function appendPbiaWebViewDiagnostic({
  event,
  details,
  level = 'info',
  formSlug,
  sessionId,
}: AppendDiagnosticOptions) {
  const entry: PbiaWebViewDiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    level,
    event,
    formSlug,
    sessionId,
    details: toDetailString(details),
  };

  if (__DEV__) {
    const logPrefix = `[PBIA WebView][${entry.level}] ${entry.event}`;
    if (entry.details) {
      console.log(`${logPrefix} ${entry.details}`);
    } else {
      console.log(logPrefix);
    }
  }

  await queueWrite(async () => {
    const diagnostics = await readDiagnostics();
    diagnostics.push(entry);
    const nextDiagnostics = diagnostics.slice(-MAX_DIAGNOSTIC_ENTRIES);
    await AsyncStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(nextDiagnostics));
  });

  return entry;
}

export async function listPbiaWebViewDiagnostics(limit = 25) {
  await writeQueue;
  const diagnostics = await readDiagnostics();
  return diagnostics.slice(-limit).reverse();
}

export async function clearPbiaWebViewDiagnostics() {
  await queueWrite(async () => {
    await AsyncStorage.removeItem(DIAGNOSTICS_STORAGE_KEY);
  });
}

export async function startPbiaWebViewSession(formSlug: string, initialUrl: string) {
  const session: PbiaWebViewActiveSession = {
    sessionId: `pbia-wv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    formSlug,
    initialUrl,
  };

  await queueWrite(async () => {
    await AsyncStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  });

  await appendPbiaWebViewDiagnostic({
    event: 'embedded-session-started',
    formSlug,
    sessionId: session.sessionId,
    details: { initialUrl },
  });

  return session;
}

export async function endPbiaWebViewSession(sessionId: string, reason: string) {
  await queueWrite(async () => {
    const activeRaw = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    const activeSession = safeParseActiveSession(activeRaw);
    if (activeSession?.sessionId === sessionId) {
      await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  });

  await appendPbiaWebViewDiagnostic({
    event: 'embedded-session-ended',
    sessionId,
    details: { reason },
  });
}

export async function recoverPbiaWebViewSessionAfterRestart() {
  let recoveredSession: PbiaWebViewActiveSession | null = null;

  await queueWrite(async () => {
    const activeRaw = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    recoveredSession = safeParseActiveSession(activeRaw);
    if (recoveredSession) {
      await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  });

  if (recoveredSession) {
    await appendPbiaWebViewDiagnostic({
      event: 'previous-embedded-session-recovered-after-app-restart',
      level: 'error',
      formSlug: recoveredSession.formSlug,
      sessionId: recoveredSession.sessionId,
      details: {
        startedAt: recoveredSession.startedAt,
        initialUrl: recoveredSession.initialUrl,
      },
    });
  }

  return recoveredSession;
}
