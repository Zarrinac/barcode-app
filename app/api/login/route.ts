function redirectWithLogin(request: Request) {
  const isHttps = new URL(request.url).protocol === 'https:';

  return new Response(null, {
    headers: {
      Location: '/?loggedIn=1',
      'Set-Cookie': `barcode-app-login=true; Path=/; Max-Age=2592000; SameSite=Lax${
        isHttps ? '; Secure' : ''
      }`,
    },
    status: 303,
  });
}

export function GET(request: Request) {
  return redirectWithLogin(request);
}

export function POST(request: Request) {
  return redirectWithLogin(request);
}
