function redirectWithLogout(request: Request) {
  const isHttps = new URL(request.url).protocol === 'https:';

  return new Response(null, {
    headers: {
      Location: '/',
      'Set-Cookie': `barcode-app-login=; Path=/; Max-Age=0; SameSite=Lax${
        isHttps ? '; Secure' : ''
      }`,
    },
    status: 303,
  });
}

export function GET(request: Request) {
  return redirectWithLogout(request);
}

export function POST(request: Request) {
  return redirectWithLogout(request);
}
