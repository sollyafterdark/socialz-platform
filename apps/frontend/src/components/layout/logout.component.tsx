'use client';

import { sessionCookieNames } from '@gitroom/helpers/auth/session.cookies';
import React, { FC, useCallback } from 'react';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const LogoutComponent: FC<{ isIcon?: boolean }> = ({ isIcon }) => {
  const fetch = useFetch();
  const { isSecured } = useVariables();
  const t = useT();
  const label = t('logout_socialz', 'Log out of Socialz');

  const logout = useCallback(async () => {
    if (
      await deleteDialog(
        t(
          'confirm_logout_socialz',
          'Are you sure you want to log out of Socialz?'
        ),
        t('yes_logout', 'Yes logout')
      )
    ) {
      if (!isSecured) {
        setCookie(sessionCookieNames.auth, '', -10);
      } else {
        await fetch('/user/logout', { method: 'POST' });
      }
      window.location.href = '/';
    }
  }, [fetch, isSecured, t]);

  return (
    <button
      type="button"
      onClick={logout}
      aria-label={label}
      title={label}
      data-tooltip-id="tooltip"
      data-tooltip-content={label}
      className={
        isIcon
          ? 'w-full min-h-[44px] flex items-center justify-center rounded-[12px] text-textItemBlur hover:text-textItemFocused hover:bg-boxFocused transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
          : 'cursor-pointer text-red-400'
      }
    >
      {isIcon ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M9 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H9M16 7L21 12L16 17M21 12H9"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        label
      )}
    </button>
  );
};
