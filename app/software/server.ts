import express, { type ErrorRequestHandler, type Request, type RequestHandler, type Response } from 'express';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = 'ofs-software-session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummySalt = randomBytes(16).toString('hex');
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function databasePool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required for the One Fin Software service.');
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

const pool = databasePool();
pool.on('error', (error) => console.error('Idle software database connection failed.', error));

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function derivePassword(password: string, salt: string, legacy = false) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, legacy ? {} : PASSWORD_SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new RequestError(400, 'Use a password between 12 and 128 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = await derivePassword(password, salt);
  return `scrypt-v1:${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split(':');
  if (!['scrypt-v1', 'scrypt'].includes(algorithm) || !salt || !encoded || password.length > 128) return false;
  const actual = await derivePassword(password, salt, algorithm === 'scrypt');
  const expected = Buffer.from(encoded, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function setSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') throw new RequestError(400, 'Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(400, 'Enter a valid email address.');
  }
  return email;
}

function readText(value: unknown, field: string) {
  if (typeof value !== 'string') throw new RequestError(400, `Enter a valid ${field}.`);
  return value;
}

function requireSameOrigin(request: Request) {
  const origin = request.get('origin');
  const host = request.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) throw new RequestError(403, 'This request is not allowed.');
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError(403, 'This request is not allowed.');
    }
  }
  if (request.get('sec-fetch-site') === 'cross-site') {
    throw new RequestError(403, 'This request is not allowed.');
  }
}

async function limitAttempts(scope: string, email: string, address: string, limit: number) {
  await pool.query('delete from ofs_store.auth_rate_limits where expires_at <= now()');
  const keyHash = hashToken(`${scope}:${email}:${address}`);
  const result = await pool.query<{ attempts: number }>(
    `insert into ofs_store.auth_rate_limits (key_hash, attempts, expires_at)
     values ($1, 1, now() + interval '15 minutes')
     on conflict (key_hash) do update
     set attempts = case when ofs_store.auth_rate_limits.expires_at < now() then 1 else ofs_store.auth_rate_limits.attempts + 1 end,
         expires_at = case when ofs_store.auth_rate_limits.expires_at < now() then now() + interval '15 minutes' else ofs_store.auth_rate_limits.expires_at end
     returning attempts`,
    [keyHash],
  );
  if (result.rows[0].attempts > limit) {
    throw new RequestError(429, 'Too many attempts. Please try again in 15 minutes.');
  }
}

async function createSession(userId: string, response: Response) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `insert into ofs_store.sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + interval '30 days')`,
    [hashToken(token), userId],
  );
  setSessionCookie(response, token);
}

async function currentUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await pool.query<{ id: string; email: string }>(
    `select users.id, users.email
     from ofs_store.sessions sessions
     join ofs_store.users users on users.id = sessions.user_id
     where sessions.token_hash = $1 and sessions.expires_at > now()
     limit 1`,
    [hashToken(token)],
  );
  return result.rows[0] || null;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => { void handler(request, response).catch(next); };
}

async function sendResetEmail(email: string, token: string) {
  const apiKey = process.env.SOFTWARE_RESEND_API_KEY?.trim();
  const from = process.env.SOFTWARE_EMAIL_FROM?.trim();
  const appUrl = process.env.SOFTWARE_APP_URL?.trim();
  if (!apiKey || !from || !appUrl) {
    throw new RequestError(503, 'Password reset email is not configured yet. Please try again later.');
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    throw new Error('SOFTWARE_APP_URL must be an absolute URL.');
  }
  if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') {
    throw new Error('SOFTWARE_APP_URL must use HTTPS in production.');
  }
  const resetUrl = new URL('/', baseUrl);
  resetUrl.searchParams.set('reset', token);
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your One Fin Software password',
      text: `Use this link within 30 minutes to reset your password: ${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Use the link below within 30 minutes to reset your password.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!result.ok) {
    const responseText = await result.text();
    console.error('Password reset email was rejected by the delivery provider.', responseText.slice(0, 500));
    throw new RequestError(502, 'We could not send the reset email. Please try again later.');
  }
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use('/api', express.json({ limit: '24kb', type: 'application/json' }));

app.get('/api/health', asyncRoute(async (_request, response) => {
  await pool.query('select 1');
  response.json({ status: 'ok' });
}));

app.get('/api/auth/session', asyncRoute(async (request, response) => {
  response.json({ user: await currentUser(request) });
}));

app.post('/api/auth/sign-up', asyncRoute(async (request, response) => {
  requireSameOrigin(request);
  const email = normalizeEmail(request.body?.email);
  const password = readText(request.body?.password, 'password');
  if (request.body?.acceptTerms !== true) {
    throw new RequestError(400, 'Agree to the Terms & Conditions and Privacy Policy to create an account.');
  }
  await limitAttempts('sign-up', email, request.ip || 'unknown', 5);
  const passwordHash = await hashPassword(password);
  let user: { id: string; email: string };
  try {
    const result = await pool.query<{ id: string; email: string }>(
      `insert into ofs_store.users (email, password_hash, accepted_terms_at, terms_version)
       values ($1, $2, now(), $3) returning id, email`,
      [email, passwordHash, process.env.SOFTWARE_TERMS_VERSION?.trim() || '2026-10'],
    );
    user = result.rows[0];
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new RequestError(409, 'An account with this email already exists. Please sign in.');
    }
    throw error;
  }
  await createSession(user.id, response);
  response.status(201).json({ user });
}));

app.post('/api/auth/sign-in', asyncRoute(async (request, response) => {
  requireSameOrigin(request);
  const email = normalizeEmail(request.body?.email);
  const password = readText(request.body?.password, 'password');
  await limitAttempts('sign-in', email, request.ip || 'unknown', 10);
  const result = await pool.query<{ id: string; email: string; password_hash: string }>(
    'select id, email, password_hash from ofs_store.users where email = $1 limit 1',
    [email],
  );
  const storedHash = result.rows[0]?.password_hash || `scrypt-v1:${dummySalt}:${'00'.repeat(64)}`;
  const passwordMatches = await verifyPassword(password, storedHash);
  if (!result.rows[0] || !passwordMatches) {
    throw new RequestError(401, 'Email or password is incorrect.');
  }
  await createSession(result.rows[0].id, response);
  response.json({ user: { id: result.rows[0].id, email: result.rows[0].email } });
}));

app.post('/api/auth/logout', asyncRoute(async (request, response) => {
  requireSameOrigin(request);
  const token = readCookie(request, SESSION_COOKIE);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await pool.query('delete from ofs_store.sessions where token_hash = $1', [hashToken(token)]);
  }
  clearSessionCookie(response);
  response.json({ ok: true });
}));

app.post('/api/auth/forgot-password', asyncRoute(async (request, response) => {
  requireSameOrigin(request);
  const email = normalizeEmail(request.body?.email);
  await limitAttempts('forgot-password', email, request.ip || 'unknown', 5);
  if (!process.env.SOFTWARE_RESEND_API_KEY?.trim() || !process.env.SOFTWARE_EMAIL_FROM?.trim() || !process.env.SOFTWARE_APP_URL?.trim()) {
    throw new RequestError(503, 'Password reset email is not configured yet. Please try again later.');
  }
  const userResult = await pool.query<{ id: string }>(
    'select id from ofs_store.users where email = $1 limit 1',
    [email],
  );
  if (userResult.rows[0]) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    await pool.query(
      `insert into ofs_store.password_reset_tokens (token_hash, user_id, expires_at)
       values ($1, $2, now() + interval '30 minutes')`,
      [tokenHash, userResult.rows[0].id],
    );
    try {
      await sendResetEmail(email, token);
    } catch (error) {
      await pool.query('delete from ofs_store.password_reset_tokens where token_hash = $1', [tokenHash]);
      throw error;
    }
  }
  response.json({ message: 'If an account exists for this address, password reset instructions have been sent.' });
}));

app.post('/api/auth/reset-password', asyncRoute(async (request, response) => {
  requireSameOrigin(request);
  const token = readText(request.body?.token, 'reset token');
  const password = readText(request.body?.password, 'password');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new RequestError(400, 'This reset link is invalid or expired. Request a new one.');
  }
  const passwordHash = await hashPassword(password);
  const client: PoolClient = await pool.connect();
  try {
    await client.query('begin');
    const deleted = await client.query<{ user_id: string }>(
      `delete from ofs_store.password_reset_tokens
       where token_hash = $1 and expires_at > now()
       returning user_id`,
      [hashToken(token)],
    );
    if (!deleted.rows[0]) throw new RequestError(400, 'This reset link is invalid or expired. Request a new one.');
    const userId = deleted.rows[0].user_id;
    await client.query('update ofs_store.users set password_hash = $1, updated_at = now() where id = $2', [passwordHash, userId]);
    await client.query('delete from ofs_store.sessions where user_id = $1', [userId]);
    await client.query('delete from ofs_store.password_reset_tokens where user_id = $1', [userId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  response.json({ ok: true });
}));

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});

const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (response.headersSent) return;
  if (error instanceof RequestError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  console.error(`Software service request failed at ${request.method} ${request.path}.`, error);
  response.status(500).json({ error: 'The request could not be completed. Please try again later.' });
};
app.use('/api', errorHandler);

async function startServer() {
  const schema = await readFile(path.join(moduleDirectory, 'schema.sql'), 'utf8');
  await pool.query(schema);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(moduleDirectory, 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_request, response) => response.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`One Fin Software listening on port ${PORT}.`);
  });
}

startServer().catch((error: unknown) => {
  console.error('One Fin Software could not start.', error);
  process.exitCode = 1;
});
