'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ForgotPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot.password.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
type Inputs = {
  email: string;
};
export function Forgot() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useMemo(() => {
    return classValidatorResolver(ForgotPasswordDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchData('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: data.email.trim(), provider: 'LOCAL' }),
      });
      const result = await response.json();
      if (!response.ok || result.forgot !== true)
        throw new Error('Reset email failed');
      setState(true);
    } catch {
      setError(
        t(
          'password_reset_email_failed',
          'We could not send the reset email. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-1 flex-col">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <h1 className="text-3xl font-bold text-start mb-4 cursor-pointer">
              {t('forgot_password_1', 'Forgot Password')}
            </h1>
          </div>
          {!state ? (
            <>
              <div className="space-y-4 text-textColor">
                <Input
                  label="Email"
                  translationKey="label_email"
                  {...form.register('email')}
                  type="email"
                  autoComplete="email"
                  aria-label={t('label_email', 'Email')}
                  placeholder={t('email_address', 'Email Address')}
                />
              </div>
              {error && (
                <p role="alert" className="text-red-400 text-sm">
                  {error}
                </p>
              )}
              <div className="text-center mt-6">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className="flex-1 !h-[52px] !rounded-[10px]"
                    loading={loading}
                  >
                    {t(
                      'send_password_reset_email',
                      'Send Password Reset Email'
                    )}
                  </Button>
                </div>
                <p className="mt-4 text-sm">
                  <Link href="/auth/login" className="underline cursor-pointer">
                    {t('go_back_to_login', 'Go back to login')}
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <div role="status" className="text-start mt-6">
                {t(
                  'password_reset_email_confirmation',
                  'If this email belongs to an email-and-password account, you will receive a reset link. Check your inbox and spam folder.'
                )}
              </div>
              <p className="mt-4 text-sm">
                <Link href="/auth/login" className="underline cursor-pointer">
                  {t('go_back_to_login', 'Go back to login')}
                </Link>
              </p>
            </>
          )}
        </form>
      </FormProvider>
    </div>
  );
}
