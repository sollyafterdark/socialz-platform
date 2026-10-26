import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { redirect } from 'next/navigation';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Socialz Register',
  description: '',
};

export default async function Auth(params: {
  searchParams: Promise<{ provider: string }>;
}) {
  const availability = await (await internalFetch('/auth/can-register')).json();
  if (
    process.env.DISABLE_REGISTRATION === 'true' &&
    !availability.register &&
    !(await params.searchParams)?.provider
  ) {
    redirect('/auth/login');
  }
  return <Register invitation={availability.invitation} />;
}
