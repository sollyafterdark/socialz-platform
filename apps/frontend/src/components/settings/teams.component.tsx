'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR, { useSWRConfig } from 'swr';
import React, { useMemo, useState } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Input } from '@gitroom/react/form/input';
import { useForm, FormProvider } from 'react-hook-form';
import { Select } from '@gitroom/react/form/select';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import copy from 'copy-to-clipboard';
import { WorkspaceSettings } from './workspace-settings.component';
import { WorkspaceActions } from './workspace-actions.component';

type TeamRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
type Member = {
  role: TeamRole;
  user: { id: string; email: string; isSuperAdmin?: boolean };
};
type Invitation = {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export const AddMember = () => {
  const user = useUser();
  const modals = useModals();
  const fetch = useFetch();
  const toast = useToaster();
  const { mutate } = useSWRConfig();
  const { data: workspaces, error: workspaceError } = useSWR<
    { id: string; name: string }[]
  >(
    'organizations',
    async () => {
      const response = await fetch('/user/organizations');
      if (!response.ok) throw new Error('Could not load workspaces');
      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );
  const workspace = Array.isArray(workspaces)
    ? workspaces.find((current) => current.id === user?.orgId)
    : undefined;
  const workspaceUnavailable =
    !!workspaceError || (Array.isArray(workspaces) && !workspace);
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useMemo(() => classValidatorResolver(AddTeamMemberDto), []);
  const form = useForm({
    defaultValues: { email: '', role: 'USER', sendEmail: true },
    resolver,
    mode: 'onChange',
  });
  const sendEmail = form.watch('sendEmail');
  const submit = async (values: {
    email: string;
    role: string;
    sendEmail: boolean;
  }) => {
    if (!workspace || workspaceError) {
      setError(
        'Could not confirm the workspace. Refresh this page before adding a member.'
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        existing ? '/settings/team/add' : '/settings/team',
        {
          method: 'POST',
          body: JSON.stringify({
            ...values,
            expectedWorkspaceId: workspace.id,
          }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          (Array.isArray(result.message)
            ? result.message[0]
            : result.message) || 'Could not add the member'
        );
      if (!existing && !values.sendEmail && !copy(result.url))
        throw new Error(
          'Could not copy the invitation. Use Copy link in Invitations.'
        );
      await mutate(`/api/teams?workspace=${user?.orgId}`);
      await mutate(`/settings/team/invitations?workspace=${user?.orgId}`);
      modals.closeAll();
      toast.show(
        existing
          ? 'Member added'
          : values.sendEmail
          ? 'Invitation email sent'
          : 'Invitation link copied'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the member');
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="relative flex gap-[12px] flex-col p-[16px] pt-0">
          <section
            aria-label="Destination workspace"
            className="bg-sixth border border-fifth rounded-[8px] p-[12px] flex flex-col gap-[6px]"
          >
            <span className="text-[13px] text-customColor18">Workspace</span>
            <strong>
              {workspace?.name ||
                (workspaceUnavailable
                  ? 'Workspace unavailable'
                  : 'Loading workspace…')}
            </strong>
            <p className="text-[12px] text-customColor18">
              This person will join this workspace only. To invite them to
              another workspace, close this dialog and switch teams in the top
              bar.
            </p>
            {workspaceUnavailable && (
              <p role="alert">
                Could not load the workspace. Refresh this page before adding a
                member.
              </p>
            )}
          </section>
          {user?.isSuperAdmin && (
            <label className="flex flex-col gap-[8px]">
              Add method
              <select
                className="bg-sixth border border-fifth rounded-[4px] p-[8px]"
                aria-label="Add method"
                value={existing ? 'existing' : 'invite'}
                onChange={(e) => setExisting(e.target.value === 'existing')}
              >
                <option value="invite">Invite by email or link</option>
                <option value="existing">
                  Add an existing Socialz account
                </option>
              </select>
            </label>
          )}
          <Input
            label="Email"
            placeholder="Enter the member’s email"
            name="email"
          />
          <Select label="Workspace role" name="role">
            <option value="USER">User</option>
            {user?.isSuperAdmin && <option value="ADMIN">Admin</option>}
          </Select>
          {!existing && (
            <>
              <label className="flex items-center gap-[8px]">
                <Checkbox name="sendEmail" />
                Send invitation by email
              </label>
              <p className="text-[13px] text-customColor18">
                The recipient must use this email address. The link works once
                and expires in 2 days.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-red-400">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || !workspace || !!workspaceError}
            loading={busy}
          >
            {existing
              ? 'Add member'
              : sendEmail
              ? 'Send invitation'
              : 'Copy invitation link'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export const TeamsComponent = () => {
  const invitationUnavailable =
    useSearchParams()?.get('invitation') === 'unavailable';
  const fetch = useFetch();
  const user = useUser();
  const modals = useModals();
  const toast = useToaster();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage =
    !!user?.isSuperAdmin || ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  const load = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load team details');
    return response.json();
  };
  const {
    data,
    error: loadError,
    mutate,
  } = useSWR<{ users: Member[] }>(
    canManage ? `/api/teams?workspace=${user?.orgId}` : null,
    () => load('/settings/team')
  );
  const { data: invitations, mutate: reloadInvitations } = useSWR<Invitation[]>(
    canManage ? `/settings/team/invitations?workspace=${user?.orgId}` : null,
    () => load('/settings/team/invitations')
  );
  const { data: audit, mutate: reloadAudit } = useSWR<
    Array<{ id: string; action: string; target: string; createdAt: string }>
  >(canManage ? `/settings/team/audit?workspace=${user?.orgId}` : null, () =>
    load('/settings/team/audit')
  );
  const action = async (path: string, method: string, body?: object) => {
    if (busy) return;
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
            : result.message) || 'Could not update team'
        );
      if (result.url && !path.endsWith('/resend')) {
        if (!copy(result.url)) throw new Error('Could not copy link');
        toast.show('Invitation link copied');
      } else if (path.endsWith('/resend')) toast.show('Invitation email sent');
      await Promise.all([mutate(), reloadInvitations(), reloadAudit()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update team');
    } finally {
      setBusy(false);
    }
  };
  const invitationNotice = invitationUnavailable ? (
    <p role="alert" className="text-red-400 mb-[16px]">
      This invitation could not be accepted. Sign in with the invited email
      address or ask an Admin for a new link.
    </p>
  ) : null;
  if (!canManage)
    return (
      <>
        {invitationNotice}
        <WorkspaceActions />
      </>
    );
  return (
    <div className="flex flex-col">
      {invitationNotice}
      <WorkspaceSettings />
      <WorkspaceActions />
      <h3 className="text-[20px]">Team Members</h3>
      <p className="text-[13px] text-customColor18 mt-[4px]">
        Admins manage Users. Only the Socialz owner can promote, demote, or
        remove Admins.
      </p>
      <div className="my-[16px] bg-sixth border border-fifth rounded-[8px] p-[20px] flex flex-col gap-[16px]">
        {loadError && (
          <p role="alert">Could not load members. Please refresh.</p>
        )}
        {(data?.users || []).map((member) => {
          const protectedOwner =
            member.user.isSuperAdmin || member.role === 'SUPERADMIN';
          const canRemove =
            !protectedOwner &&
            member.user.id !== user?.id &&
            (user?.isSuperAdmin || member.role === 'USER');
          return (
            <div
              key={member.user.id}
              className="flex flex-wrap items-center gap-[12px]"
            >
              <span className="flex-1 min-w-[160px] break-all text-[13px]">
                {member.user.email}
                {member.user.id === user?.id ? ' (you)' : ''}
              </span>
              {user?.isSuperAdmin &&
              !protectedOwner &&
              member.user.id !== user?.id ? (
                <select
                  aria-label={`Role for ${member.user.email}`}
                  className="bg-sixth border border-fifth rounded-[4px] p-[8px]"
                  value={member.role}
                  disabled={busy}
                  onChange={async (e) => {
                    const role = e.target.value;
                    if (
                      await deleteDialog(
                        `Change ${member.user.email} to ${
                          role === 'ADMIN' ? 'Admin' : 'User'
                        } in this workspace?`
                      )
                    )
                      await action(
                        `/settings/team/${member.user.id}/role`,
                        'PUT',
                        { role }
                      );
                  }}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <span className="text-[13px]">
                  {protectedOwner
                    ? 'Owner'
                    : member.role === 'ADMIN'
                    ? 'Admin'
                    : 'User'}
                </span>
              )}
              {canRemove && (
                <Button
                  secondary
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await deleteDialog(
                        `Remove ${member.user.email} from this workspace? Their account and other workspace memberships stay active.`
                      )
                    )
                      await action(
                        `/settings/team/${member.user.id}`,
                        'DELETE'
                      );
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          );
        })}
        <div>
          <Button
            onClick={() =>
              modals.openModal({
                classNames: { modal: 'bg-transparent text-textColor' },
                title: 'Add Member',
                withCloseButton: true,
                children: <AddMember />,
              })
            }
          >
            Add member
          </Button>
        </div>
      </div>
      <h3 className="text-[20px]">Invitations</h3>
      <div className="my-[16px] border border-fifth rounded-[8px] p-[20px] flex flex-col gap-[16px]">
        {!invitations?.length && (
          <p className="text-[13px] text-customColor18">No invitations yet.</p>
        )}
        {(invitations || []).map((invite) => {
          const status = invite.acceptedAt
            ? 'Accepted'
            : invite.revokedAt
            ? 'Revoked'
            : new Date(invite.expiresAt) <= new Date()
            ? 'Expired'
            : 'Pending';
          return (
            <div
              key={invite.id}
              className="flex flex-wrap gap-[8px] items-center text-[13px]"
            >
              <span className="flex-1 min-w-[160px] break-all">
                {invite.email} · {invite.role === 'ADMIN' ? 'Admin' : 'User'}
                <br />
                <span className="text-customColor18">
                  {status} · expires{' '}
                  {new Date(invite.expiresAt).toLocaleString()}
                </span>
              </span>
              {status === 'Pending' &&
                (user?.isSuperAdmin || invite.role === 'USER') && (
                  <div className="flex flex-wrap gap-[8px]">
                    {(['copy', 'resend', 'revoke'] as const).map((kind) => (
                      <Button
                        secondary
                        disabled={busy}
                        key={kind}
                        onClick={async () => {
                          if (
                            kind === 'copy' ||
                            (await deleteDialog(
                              kind === 'resend'
                                ? `Send this invitation again to ${invite.email}?`
                                : `Revoke the invitation for ${invite.email}?`
                            ))
                          )
                            await action(
                              `/settings/team/invitations/${invite.id}/${kind}`,
                              'POST'
                            );
                        }}
                      >
                        {kind === 'copy'
                          ? 'Copy link'
                          : kind === 'resend'
                          ? 'Resend'
                          : 'Revoke'}
                      </Button>
                    ))}
                  </div>
                )}
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <details className="border border-fifth rounded-[8px] p-[16px]">
        <summary className="cursor-pointer">Recent team activity</summary>
        <div className="mt-[12px] flex flex-col gap-[8px] text-[12px]">
          {!audit?.length && <p>No team changes recorded yet.</p>}
          {(audit || []).map((entry) => (
            <p key={entry.id}>
              {new Date(entry.createdAt).toLocaleString()} ·{' '}
              {entry.action.toLowerCase().replace(/_/g, ' ')}
              {entry.target ? ` · ${entry.target}` : ''}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
};
