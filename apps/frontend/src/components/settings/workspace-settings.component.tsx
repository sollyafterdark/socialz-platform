'use client';

import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const WorkspaceSettings = () => {
  const user = useUser();
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const t = useT();
  const canEdit =
    !!user?.isSuperAdmin || ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  const key = canEdit ? `/settings/workspace?workspace=${user?.orgId}` : null;
  const {
    data,
    error,
    isLoading,
    mutate: updateWorkspace,
  } = useSWR<{ id: string; name: string }>(
    key,
    async () => {
      const response = await fetch('/settings/workspace');
      if (!response.ok) throw new Error('Could not load workspace');
      return response.json();
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    setName(data?.name || '');
    setSaveError('');
  }, [data?.id, data?.name]);

  if (!canEdit) return null;

  const trimmedName = name.trim();
  const canSave =
    !!data &&
    !!trimmedName &&
    trimmedName.length <= 100 &&
    trimmedName !== data.name &&
    !saving;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/settings/workspace', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmedName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (Array.isArray(result.message)
            ? result.message[0]
            : result.message) ||
            t(
              'workspace_save_failed',
              'Could not save the workspace name. Please try again.'
            )
        );
      }
      await updateWorkspace(result, { revalidate: false });
      // Refresh the workspace switcher without reloading the page or its editors.
      void mutate('organizations').catch(() => {});
      toast.show(t('workspace_name_saved', 'Workspace name saved'), 'success');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : t(
              'workspace_save_failed',
              'Could not save the workspace name. Please try again.'
            )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-[28px]" aria-labelledby="workspace-settings-title">
      <h3 id="workspace-settings-title" className="text-[20px]">
        {t('workspace_settings', 'Workspace Settings')}
      </h3>
      <div className="my-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] mobile:p-[16px] flex flex-col gap-[12px]">
        {error ? (
          <div role="alert">
            {t(
              'workspace_load_failed',
              'Could not load the workspace. Please refresh and try again.'
            )}
          </div>
        ) : isLoading ? (
          <div>{t('loading', 'Loading')}</div>
        ) : (
          <>
            <Input
              disableForm
              label={t('workspace_name', 'Workspace name')}
              aria-label={t('workspace_name', 'Workspace name')}
              aria-describedby="workspace-name-help"
              name="workspaceName"
              value={name}
              maxLength={100}
              disabled={saving}
              removeError
              onChange={(event) => {
                setName(event.target.value);
                setSaveError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void save();
                }
              }}
            />
            <p
              id="workspace-name-help"
              className="text-[13px] text-customColor18"
            >
              {t(
                'workspace_name_help',
                'This name is shared with everyone in this workspace.'
              )}
            </p>
            {saveError && (
              <div role="alert" className="text-red-400 text-[13px]">
                {saveError}
              </div>
            )}
            <div>
              <Button
                onClick={save}
                loading={saving}
                disabled={!canSave}
                className="rounded-[8px]"
              >
                {t('save_workspace_name', 'Save workspace name')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
