'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

export const WorkspaceActions = () => {
  const user = useUser();
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canCreate =
    !!user?.isSuperAdmin || ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  const { data: workspace } = useSWR<{ id: string; name: string }>(
    `/settings/workspace?workspace=${user?.orgId}`,
    async () => {
      const response = await fetch('/settings/workspace');
      if (!response.ok) throw new Error('Could not load workspace');
      return response.json();
    }
  );
  const run = async (path: string, method: string, body?: object) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          (Array.isArray(result.message)
            ? result.message[0]
            : result.message) || 'Could not update workspace'
        );
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update workspace'
      );
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    const result = await run('/settings/workspaces', 'POST', {
      name: name.trim(),
    });
    if (!result?.id) return;
    await mutate('organizations');
    const response = await fetch('/user/change-org', {
      method: 'POST',
      body: JSON.stringify({ id: result.id }),
    });
    if (response.ok) window.location.assign('/settings?tab=teams');
    else setError('Workspace created. Select it from the team menu above.');
  };
  const remove = async () => {
    if (
      !(await deleteDialog(
        'Delete this workspace? Members will lose access and connected channels will be disconnected. Published social posts remain online.'
      ))
    )
      return;
    const result = await run('/settings/workspace', 'DELETE', {
      name: confirmation,
    });
    if (result?.deleted) window.location.assign('/launches');
  };
  const leave = async () => {
    if (
      !(await deleteDialog(
        'Leave this workspace? Your team’s posts and channels will stay with the workspace.'
      ))
    )
      return;
    const result = await run('/settings/workspace/leave', 'POST');
    if (result?.left) window.location.assign('/launches');
  };
  return (
    <section
      className="mb-[28px] flex flex-col gap-[12px]"
      aria-label="Workspace management"
    >
      {canCreate && (
        <details className="border border-fifth rounded-[8px] p-[16px]">
          <summary className="cursor-pointer">Create a workspace</summary>
          <div className="flex flex-col gap-[12px] mt-[16px]">
            <p className="text-[13px] text-customColor18">
              Create a separate team with its own channels and posts. The
              Socialz owner remains the owner of every workspace.
            </p>
            <Input
              disableForm
              removeError
              label="New workspace name"
              aria-label="New workspace name"
              name="newWorkspaceName"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (name.trim()) void create();
                }
              }}
            />
            <div>
              <Button
                disabled={busy || !name.trim()}
                loading={busy}
                onClick={create}
              >
                Create workspace
              </Button>
            </div>
          </div>
        </details>
      )}
      {user?.isSuperAdmin ? (
        <details className="border border-fifth rounded-[8px] p-[16px]">
          <summary className="cursor-pointer text-red-400">
            Delete this workspace
          </summary>
          <div className="flex flex-col gap-[12px] mt-[16px]">
            <p className="text-[13px]">
              Cancel scheduled and repeating posts and disable auto-posting
              first. All members must belong to another workspace. Your final
              workspace is protected.
            </p>
            <p className="text-[13px]">
              Channels will be disconnected and members will lose access.
              Published posts stay on social networks. Workspace records and
              media are retained for support recovery.
            </p>
            <Input
              disableForm
              removeError
              label={`Type ${
                workspace?.name || 'the workspace name'
              } to confirm`}
              aria-label="Confirm workspace deletion"
              name="confirmWorkspaceDeletion"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
            <div>
              <Button
                secondary
                className="text-red-400"
                disabled={busy || !workspace || confirmation !== workspace.name}
                onClick={remove}
              >
                Delete workspace
              </Button>
            </div>
          </div>
        </details>
      ) : (
        <div className="border border-fifth rounded-[8px] p-[16px] flex flex-col gap-[12px]">
          <p>Current workspace: {workspace?.name || 'Loading…'}</p>
          <p className="text-[13px] text-customColor18">
            You can leave after joining another workspace. Your team’s content
            stays here.
          </p>
          <div>
            <Button secondary disabled={busy} onClick={leave}>
              Leave workspace
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-400 text-[13px]">
          {error}
        </p>
      )}
    </section>
  );
};
