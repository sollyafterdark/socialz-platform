'use client';

import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';

type Workspace = {
  id: string;
  name: string;
  users: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
};

export const OrganizationSelector: FC<{ asOpenSelect?: boolean }> = ({
  asOpenSelect,
}) => {
  const fetch = useFetch();
  const user = useUser();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { isLoading, data } = useSWR<Workspace[]>('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
  const current = useMemo(
    () => data?.find((org) => org.id === user?.orgId),
    [data, user?.orgId]
  );
  const withoutCurrent = useMemo(
    () => data?.filter((org) => org.id !== user?.orgId),
    [data, user?.orgId]
  );
  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({
          id: org.id,
        }),
      });
      window.location.reload();
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  if (isLoading || !current || (asOpenSelect && data?.length === 1))
    return null;

  // Retain Postiz's open organization selector used in its billing flow.
  if (asOpenSelect) {
    return (
      <div className="text-[12px]">
        <div className="bg-btnPrimary max-w-[500px] mx-auto py-[12px] px-[12px]">
          Select Organization
        </div>
        <div className="max-w-[500px] mx-auto mb-[10px] bg-third border-tableBorder border p-[12px] flex flex-col gap-[12px]">
          {withoutCurrent?.map((org) => (
            <button
              type="button"
              key={org.id}
              onClick={changeOrg(org)}
              className="text-start truncate"
            >
              {org.name}
              {!!org.users?.[0]?.role && (
                <span className="text-customColor18">
                  {' '}
                  (
                  {org.users[0].role === 'SUPERADMIN'
                    ? 'Super-Admin'
                    : org.users[0].role === 'ADMIN'
                    ? 'Admin'
                    : 'User'}
                  )
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const label = `Current workspace: ${current.name}`;
  const name = (
    <span className="max-w-[180px] mobile:max-w-[100px] truncate">
      {current.name}
    </span>
  );
  const triggerStyle =
    'min-w-0 h-[36px] px-[10px] mobile:px-[8px] flex items-center gap-[6px] text-[13px] font-[600] rounded-[8px] border border-newTableBorder text-newTextColor';
  if (data?.length === 1) {
    return (
      <div aria-label={label} title={label} className={triggerStyle}>
        {name}
      </div>
    );
  }

  return (
    <div
      ref={container}
      className="relative min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          container.current?.querySelector('button')?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen(!open)}
        className={clsx(
          triggerStyle,
          'hover:bg-boxFocused focus-visible:outline focus-visible:outline-2'
        )}
      >
        {name}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Your workspaces"
          className="absolute top-full end-0 mt-[6px] z-[80] w-max min-w-full max-w-[min(320px,calc(100vw-32px))] max-h-[60vh] overflow-y-auto rounded-[8px] bg-newBgColorInner border border-newTableBorder shadow-lg p-[6px]"
        >
          {data?.map((org) => {
            const active = org.id === current.id;
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                key={org.id}
                onClick={active ? () => setOpen(false) : changeOrg(org)}
                className={clsx(
                  'w-full flex items-center gap-[8px] text-start p-[10px] rounded-[6px] text-[13px] hover:bg-boxFocused',
                  active && 'bg-boxFocused text-newTextColor font-[600]'
                )}
              >
                <span aria-hidden="true" className="w-[14px] shrink-0">
                  {active ? '✓' : ''}
                </span>
                <span className="truncate">{org.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
