import { resolveApiUser, UserAuthError } from "@/lib/user-account.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

export async function getUsageReport(request: Request) {
  const pool = await import("@/lib/openrouter-pool.server");
  let userId: string | null = null;
  const authorization = request.headers.get("Authorization") || "";

  if (authorization.startsWith("Bearer spk_")) {
    try {
      userId = await resolveApiUser(request);
    } catch (error) {
      if (error instanceof UserAuthError) {
        return Response.json(
          { error: "Invalid personal API token" },
          { status: 401, headers: CORS },
        );
      }
      return Response.json(
        { error: "Could not authenticate request" },
        { status: 503, headers: CORS },
      );
    }
  } else if (authorization.startsWith("Bearer ")) {
    try {
      userId = await resolveApiUser(request);
    } catch {
      userId = null;
    }
  }

  if (!userId && !(await pool.authorizeManagement(request))) {
    return Response.json(
      { error: "Management authorization required" },
      { status: 401, headers: CORS },
    );
  }

  if (!pool.hasSupabaseAdminConfig()) {
    return Response.json(
      {
        error:
          "Persistent usage reports require Supabase. See /history for recent requests on this server instance.",
      },
      { status: 503, headers: CORS },
    );
  }

  const requested = Number(new URL(request.url).searchParams.get("hours")) || 24;
  const windowHours = Math.max(1, Math.min(720, Math.floor(requested)));

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("provider_usage_report", {
      window_hours: windowHours,
      ...(userId ? { report_user_id: userId } : {}),
    });
    if (error) throw error;
    return Response.json(data, { headers: { ...CORS, "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load usage report" }, { status: 503, headers: CORS });
  }
}

export const usageReportCorsHeaders = CORS;
