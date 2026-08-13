import { withSupabase } from "npm:@supabase/server";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TITLE = "Insure Probuilders";
const MAX_MESSAGE_LENGTH = 240;
const EXPO_BATCH_SIZE = 100;
const DEVICE_PAGE_SIZE = 1_000;

type PushRequest = {
  requestId: string;
  customerEmail: string;
  message: string;
};

type Device = {
  id: string;
  expo_push_token: string;
};

type ExpoTicket = {
  status?: unknown;
  id?: unknown;
  details?: { error?: unknown } | null;
};

type SanitizedTicket =
  | { status: "ok"; id: string }
  | { status: "error"; code: string; message: string };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validExpoPushToken(value: string) {
  return /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/.test(value);
}

function parseRequest(value: unknown): PushRequest | null {
  if (!isRecord(value)) return null;

  const requestId = sanitizeString(value.requestId);
  const customerEmail = sanitizeString(value.customerEmail).toLowerCase();
  const message = sanitizeString(value.message);

  if (
    !requestId ||
    requestId.length > 128 ||
    !customerEmail ||
    customerEmail.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
    !message ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return null;
  }

  return { requestId, customerEmail, message };
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function errorTicket(code: string): SanitizedTicket {
  return {
    status: "error",
    code,
    message: "The push service did not accept this notification.",
  };
}

async function loadDevices(
  supabaseAdmin: SupabaseClient,
  customerEmail: string,
  projectId: string,
) {
  const devices: Device[] = [];

  for (let offset = 0; ; offset += DEVICE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("portal_push_devices")
      .select("id, expo_push_token")
      .eq("login_email", customerEmail)
      .eq("is_active", true)
      .eq("project_id", projectId)
      .order("id")
      .range(offset, offset + DEVICE_PAGE_SIZE - 1);

    if (error) throw error;
    const page = data ?? [];
    devices.push(...page);
    if (page.length < DEVICE_PAGE_SIZE) return devices;
  }
}

export default {
  fetch: withSupabase(
    { auth: "secret:pbia_push_sender" },
    async (request, context) => {
      if (request.method !== "POST") {
        return json({ message: "Method not allowed" }, 405);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ message: "A JSON request body is required" }, 400);
      }

      const input = parseRequest(body);
      if (!input) {
        return json({ message: "Invalid push notification request" }, 400);
      }

      const projectId = Deno.env.get("EXPO_PROJECT_ID")?.trim();
      if (!projectId) {
        console.error("Push notification function is missing EXPO_PROJECT_ID.");
        return json({ message: "Push notifications are not configured" }, 500);
      }

      let devices: Device[];
      try {
        devices = await loadDevices(
          context.supabaseAdmin,
          input.customerEmail,
          projectId,
        );
      } catch {
        console.error("Unable to load registered push devices.");
        return json({ message: "Unable to prepare push notifications" }, 500);
      }

      const deviceIdsByToken = new Map<string, string[]>();
      for (const device of devices) {
        const token = device.expo_push_token.trim();
        if (!validExpoPushToken(token)) continue;
        const ids = deviceIdsByToken.get(token) ?? [];
        ids.push(device.id);
        deviceIdsByToken.set(token, ids);
      }

      const tokens = [...deviceIdsByToken.keys()];
      if (tokens.length === 0) {
        return json({
          requestId: input.requestId,
          matchedDeviceCount: 0,
          acceptedCount: 0,
          tickets: [],
          errors: [],
        });
      }

      const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN")?.trim();
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

      const tickets: SanitizedTicket[] = [];
      const errors: Array<{ code: string; message: string }> = [];
      const inactiveDeviceIds = new Set<string>();

      for (const tokenBatch of chunks(tokens, EXPO_BATCH_SIZE)) {
        let response: Response;
        try {
          response = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(
              tokenBatch.map((token) => ({
                to: token,
                title: EXPO_TITLE,
                body: input.message,
                sound: "default",
                data: {
                  type: "generic",
                  notificationRequestId: input.requestId,
                },
              })),
            ),
          });
        } catch {
          errors.push({
            code: "EXPO_UNREACHABLE",
            message: "The push service could not be reached.",
          });
          continue;
        }

        if (!response.ok) {
          errors.push({
            code: "EXPO_REQUEST_FAILED",
            message: "The push service rejected this notification batch.",
          });
          continue;
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          errors.push({
            code: "EXPO_INVALID_RESPONSE",
            message: "The push service returned an invalid response.",
          });
          continue;
        }

        const responseTickets =
          isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
        const responseErrors =
          isRecord(payload) && Array.isArray(payload.errors)
            ? payload.errors
            : [];

        for (const _error of responseErrors) {
          errors.push({
            code: "EXPO_REQUEST_FAILED",
            message: "The push service rejected this notification batch.",
          });
        }

        for (const [index, token] of tokenBatch.entries()) {
          const ticket = responseTickets[index] as ExpoTicket | undefined;
          if (ticket?.status === "ok" && typeof ticket.id === "string") {
            tickets.push({ status: "ok", id: ticket.id });
            continue;
          }

          const code =
            ticket &&
            isRecord(ticket.details) &&
            typeof ticket.details.error === "string"
              ? ticket.details.error
              : "EXPO_TICKET_ERROR";
          tickets.push(errorTicket(code));

          if (code === "DeviceNotRegistered") {
            for (const id of deviceIdsByToken.get(token) ?? []) {
              inactiveDeviceIds.add(id);
            }
          }
        }
      }

      if (inactiveDeviceIds.size > 0) {
        const { error } = await context.supabaseAdmin
          .from("portal_push_devices")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", [...inactiveDeviceIds]);
        if (error) {
          console.error("Unable to deactivate invalid push devices.");
          errors.push({
            code: "DEVICE_DEACTIVATION_FAILED",
            message: "A device cleanup action could not be completed.",
          });
        }
      }

      const acceptedCount = tickets.filter((ticket) => ticket.status === "ok").length;
      return json({
        requestId: input.requestId,
        matchedDeviceCount: tokens.length,
        acceptedCount,
        tickets,
        errors,
      });
    },
  ),
};
