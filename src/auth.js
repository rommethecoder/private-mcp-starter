import { createRemoteJWKSet, jwtVerify } from 'jose';
const keysets = new Map();
const failure = (message, status) => Object.assign(new Error(message), { status });
export function settings(env) {
  const issuer = env.ACCESS_ISSUER,
    audience = env.ACCESS_AUDIENCE,
    allowed = (env.ALLOWED_EMAILS || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') ||
    !/^[a-f0-9]{64}$/.test(audience || '') ||
    !allowed.length ||
    allowed.some((x) => !/^\S+@\S+\.\S+$/.test(x))
  )
    throw failure(
      'Configure Access issuer, application audience and approved emails before deployment.',
      503,
    );
  return { issuer, audience, allowed };
}
export async function verifyToken(token, config, key) {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    });
    if (typeof payload.email !== 'string') throw Error('Missing identity');
    const email = payload.email.trim().toLowerCase();
    if (!config.allowed.includes(email)) throw Error('Not allowed');
    return { email, local: false };
  } catch {
    throw failure('The session is invalid or this identity is not approved.', 403);
  }
}
export async function authenticate(request, env, local = false) {
  const host = new URL(request.url).hostname;
  if (local && ['127.0.0.1', 'localhost', '[::1]'].includes(host))
    return { email: 'local@example.test', local: true };
  const config = settings(env),
    token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw failure('Sign in through Cloudflare Access.', 401);
  if (!keysets.has(config.issuer))
    keysets.set(
      config.issuer,
      createRemoteJWKSet(new URL(config.issuer + '/cdn-cgi/access/certs')),
    );
  return verifyToken(token, config, keysets.get(config.issuer));
}
