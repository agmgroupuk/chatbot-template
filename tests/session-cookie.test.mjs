import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, dependencies, env) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  runInNewContext(outputText, { exports, require: name => dependencies[name] || {}, process: { env }, URL });
  return exports;
}

test('production session cookies are secure and shared only across One Fin subdomains', () => {
  const cookies = load('lib/session-cookie.ts', {}, { NODE_ENV: 'production' });
  assert.equal(cookies.sessionCookie, '__Secure-onefin-session');
  assert.equal(cookies.legacySessionCookie, '__Host-onefin-session');
  const options = cookies.sessionCookieOptions(30 * 86400);
  assert.equal(options.domain, '.onefinsolution.online');
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');

  const local = load('lib/session-cookie.ts', {}, { NODE_ENV: 'development' });
  assert.equal(local.sessionCookie, 'onefin-session');
  assert.equal(local.legacySessionCookie, null);
  assert.equal('domain' in local.sessionCookieOptions(60), false);
});

test('middleware upgrades the legacy host-only cookie without interrupting its session', () => {
  const cookies = load('lib/session-cookie.ts', {}, { NODE_ENV: 'production' });
  const setCookies = [];
  const response = {
    cookies: { set: (...args) => setCookies.push(args) },
    headers: { set: () => {} },
  };
  const nextResponse = { next: () => response, redirect: () => response };
  const middleware = load('middleware.ts', {
    'next/server': { NextResponse: nextResponse },
    '@/lib/auth-redirect': { authRedirect: () => null },
    '@/lib/session-cookie': cookies,
  }, { NODE_ENV: 'production' }).middleware;
  middleware({
    cookies: { get: name => name === cookies.legacySessionCookie ? { value: 'a'.repeat(43) } : undefined },
    nextUrl: { pathname: '/' },
    url: 'https://onefinsolution.online/',
  });
  assert.equal(setCookies.length, 1);
  assert.equal(setCookies[0][0], cookies.sessionCookie);
  assert.equal(setCookies[0][1], 'a'.repeat(43));
  assert.equal(setCookies[0][2].domain, '.onefinsolution.online');
});
