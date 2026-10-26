import { sessionCookieNames } from '@gitroom/helpers/auth/session.cookies';
import { OAuthAuthorize } from '@gitroom/frontend/components/oauth/authorize.component';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// signed-out visitors get the page too (sign in, or use self-hosted)
export default async function OAuthAuthorizePage() {
  const get = (await cookies()).get(sessionCookieNames.auth);
  return <OAuthAuthorize logged={!!get?.name} />;
}
