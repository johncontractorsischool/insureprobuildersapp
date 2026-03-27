import { getSupabaseClient } from '@/services/supabase';

const AGENT_POOL = ['Aries Apcar', 'Mark Florea', 'Cindy Cardenas'] as const;
const DEFAULT_ASSIGNMENT_TABLE = 'portal_agent_assignments';

type AgentAssignmentRow = {
  agent_name: string | null;
};

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeForComparison(value: string | null | undefined) {
  return normalizeText(value)?.toLowerCase() ?? null;
}

function getAssignmentTableName() {
  return process.env.EXPO_PUBLIC_SUPABASE_AGENT_ASSIGNMENTS_TABLE?.trim() || DEFAULT_ASSIGNMENT_TABLE;
}

export function getAgentPool() {
  return [...AGENT_POOL];
}

export function getNextRoundRobinAgentName(lastAssignedAgentName: string | null | undefined) {
  const normalizedLast = normalizeForComparison(lastAssignedAgentName);
  if (!normalizedLast) return AGENT_POOL[0];

  const currentIndex = AGENT_POOL.findIndex(
    (agentName) => normalizeForComparison(agentName) === normalizedLast
  );
  if (currentIndex < 0) return AGENT_POOL[0];

  return AGENT_POOL[(currentIndex + 1) % AGENT_POOL.length];
}

export async function fetchLastAssignedAgentName() {
  const supabase = getSupabaseClient();
  const table = getAssignmentTableName();
  const { data, error } = await supabase
    .from(table)
    .select('agent_name')
    .order('assigned_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Unable to fetch last assigned agent (${error.message}).`);
  }

  const rows = (data ?? []) as AgentAssignmentRow[];
  return normalizeText(rows[0]?.agent_name);
}

export async function fetchNextRoundRobinAgentName() {
  const lastAssigned = await fetchLastAssignedAgentName();
  return getNextRoundRobinAgentName(lastAssigned);
}

export async function recordAssignedAgentName(agentName: string) {
  const normalizedAgentName = normalizeText(agentName);
  if (!normalizedAgentName) return;

  const supabase = getSupabaseClient();
  const table = getAssignmentTableName();
  const { error } = await supabase.from(table).insert({
    agent_name: normalizedAgentName,
    assigned_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Unable to persist assigned agent (${error.message}).`);
  }
}
