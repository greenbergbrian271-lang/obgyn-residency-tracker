const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxy7p8FiKJQHLCJlK_BBfmI0yBbII2xGxOteqQeB2MBSGY9ByORzj4GZcu78wh22nnI/exec";

const ALLOWED_ORIGINS = [
  "https://greenbergbrian271-lang.github.io",
  "https://obgyn-residency-tracker.greenbergbrian271.workers.dev"
];

const API_PATH = "/api";

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.pathname === API_PATH ||
      url.pathname.startsWith(API_PATH + "/")
    ) {
      const origin = request.headers.get("Origin");

      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Forbidden origin"
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin)
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
              ...corsHeaders(origin),
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      }

      try {
        if (request.method === "GET") {
          const upstreamResponse = await fetch(APPS_SCRIPT_URL, {
            method: "GET",
            redirect: "follow"
          });

          const responseBody = await upstreamResponse.text();

          return new Response(responseBody, {
            status: upstreamResponse.status,
            headers: {
              ...corsHeaders(origin),
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          });
        }

        const body = await request.text();

        // First POST to Apps Script without automatically following redirects.
        let upstreamResponse = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body,
          redirect: "manual"
        });

        // If Apps Script redirects, follow it explicitly while preserving POST.
        if (
          upstreamResponse.status >= 300 &&
          upstreamResponse.status < 400
        ) {
          const location = upstreamResponse.headers.get("Location");

          if (!location) {
            throw new Error("Apps Script redirected without a Location header");
          }

          upstreamResponse = await fetch(location, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body,
            redirect: "follow"
          });
        }

        const responseBody = await upstreamResponse.text();

        return new Response(responseBody, {
          status: upstreamResponse.status,
          headers: {
            ...corsHeaders(origin),
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });

      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Proxy error",
            message: error instanceof Error
              ? error.message
              : String(error)
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders(origin),
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
