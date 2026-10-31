import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let location = "/login?auth_error=google";
  if (code && !url.searchParams.has("error")) {
    try {
      const supabase = await createClient();
      const flowId = url.searchParams.get("sb_flow_id");
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error) location = "/chat";
    } catch {
      // Network failures should return to a usable sign-in screen too.
    }
  }
  // A relative Location keeps the browser's origin, including behind a reverse proxy.
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}
