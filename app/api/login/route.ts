import { UserRole } from '@prisma/client';

import {
  createCookieHeader,
  createSessionToken,
  legacyLoginCookieName,
  sessionCookieName,
  verifyPassword,
} from '@/lib/auth';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const allowedUsernames = new Set(['admin', 'rsf']);

async function readCredentials(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await readJsonBody(request);

    return {
      password: readString(body, 'password'),
      username: readString(body, 'username').toLowerCase(),
    };
  }

  const formData = await request.formData();

  return {
    password: formData.get('password')?.toString().trim() ?? '',
    username: formData.get('username')?.toString().trim().toLowerCase() ?? '',
  };
}

function wantsJson(request: Request) {
  return (
    request.headers.get('accept')?.includes('application/json') ||
    request.headers.get('content-type')?.includes('application/json')
  );
}

function loginResponse(request: Request, user: { role: UserRole; username: string }) {
  const sessionToken = createSessionToken(user);
  const headers = new Headers();

  headers.append(
    'Set-Cookie',
    createCookieHeader(request, sessionCookieName, sessionToken, { httpOnly: true }),
  );
  headers.append('Set-Cookie', createCookieHeader(request, legacyLoginCookieName, 'true'));

  if (wantsJson(request)) {
    return Response.json(
      {
        ok: true,
        user: {
          role: user.role,
          username: user.username,
        },
      },
      { headers },
    );
  }

  headers.set('Location', '/?loggedIn=1');

  return new Response(null, { headers, status: 303 });
}

function invalidLoginResponse(request: Request) {
  if (wantsJson(request)) {
    return jsonError('نام کاربری یا رمز عبور اشتباه است.', 401);
  }

  return new Response(null, { headers: { Location: '/?loginError=1' }, status: 303 });
}

export function GET() {
  return new Response(null, { headers: { Location: '/' }, status: 303 });
}

export async function POST(request: Request) {
  const { password, username } = await readCredentials(request);

  if (!username || !password || !allowedUsernames.has(username)) {
    return invalidLoginResponse(request);
  }

  const user = await prisma.user.findUnique({
    select: {
      isActive: true,
      passwordHash: true,
      role: true,
      username: true,
    },
    where: { username },
  });

  if (!user?.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return invalidLoginResponse(request);
  }

  return loginResponse(request, user);
}
