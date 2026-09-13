/**
 * Cloudflare Worker for Moneo
 * Serves static files from R2 with edge caching
 */

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle OPTIONS request for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Determine file path from URL
    let filePath = url.pathname;
    if (filePath === "/") {
      filePath = "/index.html";
    }

    // Remove leading slash for R2
    const r2Key = filePath.slice(1);

    // Try to get file from R2
    const object = await env.R2_BUCKET?.get(r2Key);

    if (object) {
      // Determine content type
      const contentType = getContentType(filePath);

      return new Response(object.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    // Debug: return what we tried to fetch
    return new Response(`Not Found. Tried to fetch: ${r2Key}`, { status: 404, headers: corsHeaders });
  },
};

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'woff2': 'font/woff2',
    'webmanifest': 'application/manifest+json',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}
