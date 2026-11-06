import { authenticate } from './auth.js';
import { handleApi } from './api.js';
import { handleMcp } from './mcp.js';
function secure(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self';frame-ancestors 'none';base-uri 'none';form-action 'self'",
  );
  return new Response(response.body, { status: response.status, headers });
}
export async function handle(request, env, local = false) {
  try {
    const user = await authenticate(request, env, local),
      path = new URL(request.url).pathname;
    if (path === '/mcp') return secure(await handleMcp(request, env, user));
    if (path.startsWith('/api/')) return secure(await handleApi(request, env, user));
    return secure(await env.ASSETS.fetch(request));
  } catch (e) {
    return secure(
      Response.json(
        { error: e.status ? e.message : 'Unable to complete this request.' },
        { status: e.status || 500 },
      ),
    );
  }
}
export default { fetch: (request, env) => handle(request, env, false) };
