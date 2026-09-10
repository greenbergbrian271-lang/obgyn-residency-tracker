const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxy7p8FiKJQHLCJlK_BBfmI0yBbII2xGxOteqQeB2MBSGY9ByORzj4GZcu78wh22nnI/exec";

const ALLOWED_ORIGIN =
  "https://greenbergbrian271-lang.github.io";

const API_PATH = "/api";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle the API endpoint.
    if (url.pathname === API_PATH || url.pathname.startsWith(API_PATH + "/")) {
      
      const origin = request.headers.get("Origin");

      // Only allow requests from your GitHub Pages site.
      if (origin && origin !== ALLOWED_ORIGIN) {
        return new Response("Forbidden", {
          status: 403,
          headers: corsHeaders()
        });
      }

      // Handle CORS preflight.
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      if (request.method !== "GET" && request.method !== "POST") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Method not allowed"
          }),
          {
            status: 405,
            headers: {
              ...corsHeaders(),
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      try {
        const upstreamRequest = new Request(APPS_SCRIPT_URL, {
          method: request.method,
          headers: {
            "Content-Type":
              request.headers.get("Content-Type") ||
              "text/plain;charset=utf-8"
          },
          body:
            request.method === "POST"
              ? await request.text()
              : undefined,
          redirect: "follow"
        });

        const upstreamResponse = await fetch(upstreamRequest);

        const responseBody = await upstreamResponse.text();

        return new Response(responseBody, {
          status: upstreamResponse.status,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json; charset=utf-8"
          }
        });

      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Proxy error",
            message: error.message
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders(),
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }
    }

    // Everything else is your normal static website.
    return env.ASSETS.fetch(request);
  }
};
