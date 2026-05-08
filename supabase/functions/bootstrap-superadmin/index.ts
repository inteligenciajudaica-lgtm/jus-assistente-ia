import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPERADMIN_EMAIL = "sac@ms3.com.br";
const SUPERADMIN_PASSWORD = "BiAnCA220505!@#";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find user by email
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const found = list.users.find((u) => u.email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase());

    if (found) {
      userId = found.id;
      // Ensure email is confirmed and password is set as expected
      await admin.auth.admin.updateUserById(userId, {
        password: SUPERADMIN_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Ensure admin role
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleErr) throw roleErr;
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("bootstrap-superadmin error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
