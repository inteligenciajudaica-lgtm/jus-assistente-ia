import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Notice {
  id: string;
  title?: string;
  message?: string;
  level?: "info" | "warning" | "success";
  created_at?: string;
  expires_at?: string | null;
  active?: boolean;
}

function isExpired(n: Notice, defaultTtlHours: number | null, now: number): boolean {
  if (n.expires_at) return new Date(n.expires_at).getTime() < now;
  if (defaultTtlHours && n.created_at) {
    return new Date(n.created_at).getTime() + defaultTtlHours * 3600 * 1000 < now;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "system_notices")
      .maybeSingle();

    if (error) throw error;

    const value = (data?.value ?? {}) as { notices?: Notice[]; default_ttl_hours?: number };
    const notices = Array.isArray(value.notices) ? value.notices : [];
    const defaultTtlHours =
      typeof value.default_ttl_hours === "number" && value.default_ttl_hours > 0
        ? value.default_ttl_hours
        : null;
    const now = Date.now();

    const kept = notices.filter((n) => n.active !== false && !isExpired(n, defaultTtlHours, now));
    const removed = notices.length - kept.length;

    if (removed > 0) {
      const { error: upErr } = await supabase
        .from("app_settings")
        .update({ value: { ...value, notices: kept }, updated_at: new Date().toISOString() })
        .eq("key", "system_notices");
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({ ok: true, removed, kept: kept.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
