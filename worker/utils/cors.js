// ══════════════════════════════════════════════════════════
//  CORS HELPERS
// ══════════════════════════════════════════════════════════
export const CORS_ALLOW_ORIGIN = "*"; // ganti ke "https://username.github.io" kalau mau dibatasi

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
