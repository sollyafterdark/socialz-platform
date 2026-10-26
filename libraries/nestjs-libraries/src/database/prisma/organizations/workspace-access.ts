import { ForbiddenException } from '@nestjs/common';
import { Organization, Role, User } from '@prisma/client';

export type WorkspaceContext = Organization & { users?: { role: Role }[] };
export type WorkspaceActor = Pick<User, 'id' | 'isSuperAdmin'>;

export function assertWorkspaceAdmin(
  org: WorkspaceContext,
  user: WorkspaceActor
) {
  if (
    !user.isSuperAdmin &&
    !['ADMIN', 'SUPERADMIN'].includes(org.users?.[0]?.role || '')
  ) {
    throw new ForbiddenException('Only workspace admins can manage this team');
  }
}

export function assertServerOwner(user: WorkspaceActor) {
  if (!user.isSuperAdmin) {
    throw new ForbiddenException(
      'Only the Socialz owner can manage administrators or delete workspaces'
    );
  }
}

export function assertInviteRole(
  org: WorkspaceContext,
  user: WorkspaceActor,
  role: string
) {
  assertWorkspaceAdmin(org, user);
  if (role !== 'USER' && role !== 'ADMIN')
    throw new ForbiddenException('Invalid workspace role');
  if (role === 'ADMIN') assertServerOwner(user);
}
