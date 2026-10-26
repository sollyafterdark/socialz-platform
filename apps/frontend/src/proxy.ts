import { sessionCookieNames } from '@gitroom/helpers/auth/session.cookies';
import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import acceptLanguage from 'accept-language';
import {
  cookieName,
  headerName,
  languages,
} from '@gitroom/react/translation/i18n.config';
acceptLanguage.languages(languages);

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const rawAuth =
    request.cookies.get(sessionCookieNames.auth)?.value ||
    request.headers.get('auth') ||
    nextUrl.searchParams.get('loggedAuth');
  // Cookie presence alone does not establish a live session. In particular,
  // expired tokens or cookies issued by another app must not redirect sign-in.
  let authCookie: string | undefined;
  if (rawAuth && process.env.JWT_SECRET) {
    try {
      const payload = verify(rawAuth, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
      if (
        typeof payload === 'object' &&
        typeof payload.id === 'string' &&
        payload.id
      ) {
        authCookie = rawAuth;
      }
    } catch {
      // The API remains the authority for account and organisation access.
    }
  }
  const clearSession = (response: NextResponse) => {
    for (const name of [
      sessionCookieNames.auth,
      sessionCookieNames.showorg,
      sessionCookieNames.impersonate,
    ]) {
      response.cookies.set(name, '', {
        path: '/',
        ...(!process.env.NOT_SECURED
          ? { secure: true, httpOnly: true, sameSite: 'none' as const }
          : {}),
        maxAge: -1,
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
      });
    }
    return response;
  };
  const lng = request.cookies.has(cookieName)
    ? acceptLanguage.get(request.cookies.get(cookieName).value)
    : acceptLanguage.get(
        request.headers.get('Accept-Language') ||
          request.headers.get('accept-language')
      );

  const requestHeaders = new Headers(request.headers);
  if (lng) {
    requestHeaders.set(headerName, lng);
  }

  const topResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (lng) {
    topResponse.headers.set(cookieName, lng);
  }

  if (nextUrl.pathname.startsWith('/modal/') && !authCookie) {
    return NextResponse.redirect(new URL(`/auth/login-required`, nextUrl.href));
  }

  if (
    // Public branding and Corresponding Source must work before sign-in.
    nextUrl.pathname.startsWith('/brand/') ||
    nextUrl.pathname.startsWith('/source/') ||
    nextUrl.pathname.startsWith('/uploads/') ||
    nextUrl.pathname.startsWith('/p/') ||
    nextUrl.pathname.startsWith('/provider/') ||
    nextUrl.pathname.startsWith('/icons/') ||
    // the consent screen of MCP / OAuth clients handles signed-out visitors
    // itself (sign in and come back, or connect a self-hosted instance)
    nextUrl.pathname.startsWith('/oauth/authorize')
  ) {
    return topResponse;
  }

  if (
    nextUrl.pathname.startsWith('/integrations/social/') &&
    nextUrl.href.indexOf('state=login') === -1
  ) {
    return topResponse;
  }

  // If the URL is logout, delete the cookie and redirect to login
  if (nextUrl.href.indexOf('/auth/logout') > -1) {
    const response = NextResponse.redirect(
      new URL('/auth/login', nextUrl.href)
    );
    return clearSession(response);
  }

  if (
    nextUrl.pathname.startsWith('/auth/register') &&
    process.env.DISABLE_REGISTRATION === 'true' &&
    !request.cookies.has(sessionCookieNames.org)
  ) {
    return NextResponse.redirect(new URL('/auth/login', nextUrl.href));
  }

  if (
    !authCookie &&
    (rawAuth || request.cookies.has(sessionCookieNames.auth))
  ) {
    return clearSession(
      nextUrl.pathname.startsWith('/auth')
        ? topResponse
        : NextResponse.redirect(new URL('/auth/login', nextUrl.href))
    );
  }

  // Recovery must also work for people who are already signed in. Do not send
  // either the request form or an emailed reset link back to the dashboard.
  if (
    nextUrl.pathname === '/auth/forgot' ||
    nextUrl.pathname.startsWith('/auth/forgot/')
  ) {
    return topResponse;
  }

  const org = nextUrl.searchParams.get('org');
  const url = new URL(nextUrl).search;
  if (!nextUrl.pathname.startsWith('/auth') && !authCookie) {
    const providers = ['google', 'settings'];
    const findIndex = providers.find((p) => nextUrl.href.indexOf(p) > -1);
    const additional = !findIndex
      ? ''
      : (url.indexOf('?') > -1 ? '&' : '?') +
        `provider=${(findIndex === 'settings'
          ? process.env.POSTIZ_GENERIC_OAUTH
            ? 'generic'
            : 'github'
          : findIndex
        ).toUpperCase()}`;
    return NextResponse.redirect(
      new URL(`/auth${url}${additional}`, nextUrl.href)
    );
  }

  // If the url is /auth and the cookie exists, redirect to /
  if (nextUrl.pathname.startsWith('/auth') && authCookie) {
    return NextResponse.redirect(new URL(`/${url}`, nextUrl.href));
  }
  if (nextUrl.pathname.startsWith('/auth') && !authCookie) {
    if (org) {
      const redirect = NextResponse.redirect(new URL(`/`, nextUrl.href));
      redirect.cookies.set(sessionCookieNames.org, org, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
      return redirect;
    }
    return topResponse;
  }
  try {
    if (org) {
      const joinResponse = await internalFetch('/user/join-org', {
        body: JSON.stringify({
          org,
        }),
        method: 'POST',
      });
      const { id } = joinResponse.ok ? await joinResponse.json() : { id: null };
      const redirect = NextResponse.redirect(
        new URL(
          id ? '/?added=true' : '/settings?tab=teams&invitation=unavailable',
          nextUrl.href
        )
      );
      if (id) {
        redirect.cookies.set(sessionCookieNames.showorg, id, {
          ...(!process.env.NOT_SECURED
            ? {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: false,
                domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
              }
            : {}),
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        });
      }
      return redirect;
    }
    if (nextUrl.pathname === '/') {
      return NextResponse.redirect(
        new URL(
          !!process.env.IS_GENERAL ? '/launches' : `/analytics`,
          nextUrl.href
        )
      );
    }

    return topResponse;
  } catch (err) {
    console.log('err', err);
    return NextResponse.redirect(new URL('/auth/logout', nextUrl.href));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)',
};
