'use client';
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
type Inputs = {
  password: string;
  repeatPassword: string;
  token: string;
};
export function ForgotReturn({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const t = useT();
  const [state, setState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useMemo(() => {
    return classValidatorResolver(ForgotReturnPasswordDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    mode: 'onChange',
    defaultValues: {
      token,
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchData('/auth/forgot-return', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || result.reset !== true) {
        setError(
          t(
            'password_reset_link_expired',
            'Your password reset link has expired. Please try again.'
          )
        );
        return;
      }
      setState(true);
      form.reset();
    } catch {
      setError(
        t(
          'password_reset_failed',
          'We could not reset your password. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <h1 className="text-3xl font-bold text-start mb-4 cursor-pointer">
            {t('change_password', 'Change Password')}
          </h1>
        </div>
        {!state ? (
          <>
            <div className="space-y-4 text-textColor">
              <Input
                label="New Password"
                translationKey="label_new_password"
                {...form.register('password')}
                type="password"
                autoComplete="new-password"
                aria-label={t('label_new_password', 'New Password')}
                placeholder={t('label_password', 'Password')}
              />
              <Input
                label="Repeat Password"
                translationKey="label_repeat_password"
                {...form.register('repeatPassword')}
                type="password"
                autoComplete="new-password"
                aria-label={t('label_repeat_password', 'Repeat Password')}
                placeholder={t('label_repeat_password', 'Repeat Password')}
              />
            </div>
            {error && (
              <div role="alert" className="text-red-400 text-sm mt-2">
                <p>{error}</p>
                <Link
                  href="/auth/forgot"
                  prefetch={false}
                  className="underline"
                >
                  {t('request_new_reset_link', 'Request a new reset link')}
                </Link>
              </div>
            )}
            <div className="text-center mt-6">
              <div className="w-full flex">
                <Button type="submit" className="flex-1" loading={loading}>
                  {t('change_password', 'Change Password')}
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
                'password_reset_complete',
                'Your password has been reset. You can now sign in with your new password.'
              )}
            </div>
            <p className="mt-4 text-sm">
              <Link
                href="/auth/logout"
                prefetch={false}
                className="underline cursor-pointer"
              >
                {t('go_back_to_login', 'Go back to login')}
              </Link>
            </p>
          </>
        )}
      </form>
    </FormProvider>
  );
}
