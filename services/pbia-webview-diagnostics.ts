import { Platform } from 'react-native';

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
let diagnostics: PbiaWebViewDiagnosticEntry[] = [];
let activeSession: PbiaWebViewActiveSession | null = null;

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

async function readDiagnostics() {
  return diagnostics;
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
    diagnostics = [...diagnostics, entry].slice(-MAX_DIAGNOSTIC_ENTRIES);
  });

  return entry;
}

export async function listPbiaWebViewDiagnostics(limit = 25) {
  await writeQueue;
  const items = await readDiagnostics();
  return items.slice(-limit).reverse();
}

export async function clearPbiaWebViewDiagnostics() {
  await queueWrite(async () => {
    diagnostics = [];
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
    activeSession = session;
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
    if (activeSession?.sessionId === sessionId) {
      activeSession = null;
    }
  });

  await appendPbiaWebViewDiagnostic({
    event: 'embedded-session-ended',
    sessionId,
    details: { reason },
  });
}

export async function recoverPbiaWebViewSessionAfterRestart() {
  await writeQueue;
  const session = activeSession;
  activeSession = null;

  if (session) {
    await appendPbiaWebViewDiagnostic({
      event: 'previous-embedded-session-recovered-after-app-restart',
      level: 'error',
      formSlug: session.formSlug,
      sessionId: session.sessionId,
      details: {
        startedAt: session.startedAt,
        initialUrl: session.initialUrl,
      },
    });
  }

  return session;
}
