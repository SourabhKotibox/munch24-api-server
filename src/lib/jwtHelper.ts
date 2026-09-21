import type { FastifyRequest } from 'fastify';

/**
 * Universal token extractor for mobile and web clients.
 * Supports:
 * - Authorization: Bearer <token>
 * - Authorization: bearer <token>
 * - Authorization: <token> (raw token without Bearer prefix)
 * - Headers: x-access-token, token, auth-token
 * - Strips surrounding quotes (common issue when tokens are serialized with JSON.stringify in Flutter SharedPreferences)
 * - Query parameter fallback: ?token=... or ?auth=... or ?accessToken=...
 */
export function extractJwtToken(request: FastifyRequest): string | undefined {
  if (!request) return undefined;

  const headers = request.headers || {};
  const raw = (
    headers.authorization ||
    headers['x-access-token'] ||
    headers.token ||
    headers['auth-token']
  ) as string | undefined;

  let tokenCandidate = raw;

  // Query parameter fallback
  if (!tokenCandidate && request.query) {
    const q = request.query as Record<string, any>;
    tokenCandidate = q.token || q.auth || q.accessToken;
  }

  if (!tokenCandidate || typeof tokenCandidate !== 'string') {
    return undefined;
  }

  let token = tokenCandidate.trim();

  // Strip 'Bearer ' or 'bearer ' prefix
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // Strip surrounding quotes if present
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  return token || undefined;
}
