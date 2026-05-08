import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Não autenticado");

    // Verify caller and admin role
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Não autenticado");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Acesso negado");

    const body = await req.json().catch(() => ({}));
    const { action } = body as { action: string };

    if (action === "list_emails") {
      const ids: string[] = body.user_ids ?? [];
      const out: Record<string, { email: string | null; banned_until: string | null }> = {};
      // listUsers paginates; fetch all (simple loop up to ~10 pages)
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        for (const u of data.users) {
          if (!ids.length || ids.includes(u.id)) {
            out[u.id] = {
              email: u.email ?? null,
              banned_until: (u as any).banned_until ?? null,
            };
          }
        }
        if (data.users.length < 200) break;
      }
      return json({ ok: true, users: out });
    }

    if (action === "update_user") {
      const { user_id, email, password, suspended } = body;
      if (!user_id) throw new Error("user_id obrigatório");
      const updates: Record<string, unknown> = {};
      if (typeof email === "string" && email.trim()) {
        updates.email = email.trim();
        updates.email_confirm = true;
      }
      if (typeof password === "string" && password.length >= 6) {
        updates.password = password;
      }
      if (typeof suspended === "boolean") {
        // "none" lifts ban; "876000h" ~ 100 years
        updates.ban_duration = suspended ? "876000h" : "none";
      }
      if (Object.keys(updates).length === 0) throw new Error("Nada a atualizar");
      const { error } = await admin.auth.admin.updateUserById(user_id, updates);
      if (error) throw error;
      return json({ ok: true });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (e: any) {
    console.error("admin-users error", e);
    return json({ ok: false, error: e.message ?? String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
