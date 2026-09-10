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

    // ============================================================
    // API PROXY
    // ============================================================
    if (
      url.pathname === API_PATH ||
      url.pathname.startsWith(API_PATH + "/")
    ) {
      const origin = request.headers.get("Origin");

      // Only allow requests from the approved tracker sites.
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

      // CORS preflight.
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
        let upstreamResponse;

        // ========================================================
        // GET
        // ========================================================
        if (request.method === "GET") {
          upstreamResponse = await fetch(APPS_SCRIPT_URL, {
            method: "GET",
            redirect: "follow"
          });
        }

        // ========================================================
        // POST
        // ========================================================
        if (request.method === "POST") {
          const body = await request.text();

          /*
           * IMPORTANT:
           * Google Apps Script executes doPost(), then redirects to a
           * googleusercontent URL containing the generated response.
           *
           * We intentionally let fetch() follow that redirect normally.
           * For Google's 302 response, the redirected request becomes GET,
           * which is how the Apps Script response is retrieved.
           */
          upstreamResponse = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: body,
            redirect: "follow"
          });
        }

        const responseBody = await upstreamResponse.text();

        /*
         * Apps Script should return JSON. If Google sends an HTML error
         * page, return a useful JSON error to the tracker instead of
         * pretending that HTML is JSON.
         */
        let parsed;

        try {
          parsed = JSON.parse(responseBody);
        } catch (error) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Apps Script returned a non-JSON response",
              upstreamStatus: upstreamResponse.status,
              message: responseBody.slice(0, 500)
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

        return new Response(
          JSON.stringify(parsed),
          {
            status: upstreamResponse.status,
            headers: {
              ...corsHeaders(origin),
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Proxy error",
            message:
              error instanceof Error
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

    // ============================================================
    // STATIC WEBSITE
    // ============================================================
    return env.ASSETS.fetch(request);
  }
};
