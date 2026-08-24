import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CUSTOMER_TABLE = "portal_customers";
const SIGNUP_TABLE = "portal_signups";
const DIGITAL_CARD_TABLE = "digital_business_cards";
const DIGITAL_CARD_BUCKET = "digital-card-media";
const PBIA_INTERNAL_BLOCK_PATH = "/internal/client-account-access-blocks";
const DELETION_REASON = "USER_REQUESTED_DELETION";

type StorageEntry = {
  id: string | null;
  name: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message.trim().toLowerCase() : "";
}

function isOptionalCardTableMissing(error: unknown) {
  const message = errorText(error);
  const code =
    error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
      ? String((error as { code: string }).code).toLowerCase()
      : "";
  return (
    code === "pgrst205" ||
    code === "42p01" ||
    (message.includes("digital_business_cards") &&
      (message.includes("does not exist") || message.includes("could not find the table")))
  );
}

function isMissingDigitalCardBucket(error: unknown) {
  const message = errorText(error);
  return message.includes("bucket not found") || message.includes("storage bucket not found");
}

async function createPbiaAccessBlock(email: string, userId: string) {
  const baseUrl = Deno.env.get("PBIA_INTERNAL_API_BASE_URL")?.trim().replace(/\/+$/, "");
  const serviceToken = Deno.env.get("PBIA_INTERNAL_SERVICE_TOKEN")?.trim();
  if (!baseUrl || !serviceToken) {
    throw new Error("PBIA account access-block integration is not configured");
  }

  const response = await fetch(`${baseUrl}${PBIA_INTERNAL_BLOCK_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Internal-Service-Token": serviceToken,
      "Idempotency-Key": `account-deletion-${userId}`,
    },
    body: JSON.stringify({ email, reason: DELETION_REASON }),
  });

  if (!response.ok) {
    throw new Error(`PBIA access-block request failed with status ${response.status}`);
  }
}

async function removeStorageFiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  prefix: string,
) {
  const { data, error } = await supabaseAdmin.storage
    .from(DIGITAL_CARD_BUCKET)
    .list(prefix, { limit: 1_000, offset: 0 });

  if (error) throw error;

  const paths: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id) {
      paths.push(path);
      continue;
    }

    const { data: nested, error: nestedError } = await supabaseAdmin.storage
      .from(DIGITAL_CARD_BUCKET)
      .list(path, { limit: 1_000, offset: 0 });
    if (nestedError) throw nestedError;
    paths.push(...((nested ?? []) as StorageEntry[]).map((file) => `${path}/${file.name}`));
  }

  if (paths.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage
      .from(DIGITAL_CARD_BUCKET)
      .remove(paths);
    if (removeError) throw removeError;
  }
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ message: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY")?.trim() ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ message: "Account deletion is not configured" }, 500);
    }

    const authorization = request.headers.get("Authorization")?.trim();
    if (!authorization?.toLowerCase().startsWith("bearer ")) {
      return json({ message: "Authentication is required" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    const user = userData.user;
    const email = user?.email?.trim().toLowerCase();
    if (userError || !user || !email) {
      return json({ message: "Your secure account session is invalid or expired" }, 401);
    }

    try {
      await createPbiaAccessBlock(email, user.id);
    } catch (error) {
      console.error("Unable to create the PBIA account access block before deletion.", error);
      return json(
        { message: "Unable to protect your retained insurance records. Your account was not deleted." },
        502,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // These records belong to the Supabase portal identity. Momentum/CRM data is intentionally untouched.
    const [customerResult, signupResult] = await Promise.all([
      supabaseAdmin.from(CUSTOMER_TABLE).delete().eq("login_email", email),
      supabaseAdmin.from(SIGNUP_TABLE).delete().eq("login_email", email),
    ]);
    let dataError = customerResult.error ?? signupResult.error;
    const cardResult = await supabaseAdmin.from(DIGITAL_CARD_TABLE).delete().eq("owner_id", user.id);
    if (cardResult.error && !isOptionalCardTableMissing(cardResult.error)) {
      dataError = dataError ?? cardResult.error;
    }
    if (dataError) {
      console.error("Unable to remove app-owned portal data before account deletion.");
      return json({ message: "Unable to remove your app account data" }, 500);
    }

    try {
      await removeStorageFiles(supabaseAdmin, user.id);
    } catch (error) {
      if (!isMissingDigitalCardBucket(error)) {
        console.error("Unable to remove digital-card media before account deletion.");
        return json({ message: "Unable to remove your app account data" }, 500);
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Unable to delete the account authentication user.");
      return json({ message: "Unable to delete your account" }, 500);
    }

    return json({ deleted: true });
  },
};
