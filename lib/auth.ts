import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const sessionCookieName = 'barcode-app-session';
export const legacyLoginCookieName = 'barcode-app-login';

const passwordHashPrefix = 'scrypt';
const defaultSessionMaxAgeSeconds = 60 * 60 * 8;

type SessionPayload = {
  exp: number;
  role: string;
  username: string;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.DATABASE_URL || 'barcode-app-development-secret';
}

function getSessionMaxAgeSeconds() {
  const configuredMaxAge = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS);

  return Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
    ? Math.floor(configuredMaxAge)
    : defaultSessionMaxAgeSeconds;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${passwordHashPrefix}$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, storedKey] = storedHash.split('$');

  if (prefix !== passwordHashPrefix || !salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKeyBuffer = Buffer.from(storedKey, 'base64url');

  return (
    storedKeyBuffer.length === derivedKey.length && timingSafeEqual(storedKeyBuffer, derivedKey)
  );
}

export function createSessionToken(user: { role: string; username: string }) {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + getSessionMaxAgeSeconds(),
    role: user.role,
    username: user.username,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

    if (!payload.username || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const cookiePrefix = `${name}=`;
  const cookie = cookies.find((value) => value.startsWith(cookiePrefix));

  return cookie ? decodeURIComponent(cookie.slice(cookiePrefix.length)) : undefined;
}

export function createCookieHeader(
  request: Request,
  name: string,
  value: string,
  options?: { httpOnly?: boolean; maxAge?: number },
) {
  const isHttps = new URL(request.url).protocol === 'https:';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${options?.maxAge ?? getSessionMaxAgeSeconds()}`,
    'SameSite=Lax',
  ];

  if (options?.httpOnly) {
    parts.push('HttpOnly');
  }

  if (isHttps) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
