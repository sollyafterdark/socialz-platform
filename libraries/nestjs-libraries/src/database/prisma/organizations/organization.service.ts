import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { Organization, ShortLinkPreference, User } from '@prisma/client';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import {
  assertWorkspaceAdmin,
  assertServerOwner,
  assertInviteRole,
  WorkspaceContext,
} from './workspace-access';

@Injectable()
export class OrganizationService {
  constructor(
    private _organizationRepository: OrganizationRepository,
    private _notificationsService: NotificationService
  ) {}
  async createOrgAndUser(
    body: Omit<CreateOrgUserDto, 'providerToken'> & { providerId?: string },
    ip: string,
    userAgent: string
  ) {
    return this._organizationRepository.createOrgAndUser(
      body,
      this._notificationsService.hasEmailProvider(),
      ip,
      userAgent
    );
  }

  async getCount() {
    return this._organizationRepository.getCount();
  }

  async createMaxUser(
    id: string,
    name: string,
    saasName: string,
    email: string
  ) {
    return this._organizationRepository.createMaxUser(
      id,
      name,
      saasName,
      email
    );
  }

  addUserToOrg(
    userId: string,
    id: string,
    orgId: string,
    role: 'USER' | 'ADMIN'
  ) {
    return this._organizationRepository.addUserToOrg(userId, id, orgId, role);
  }

  getOrgById(id: string) {
    return this._organizationRepository.getOrgById(id);
  }

  getOrgByIdWithSubscription(id: string) {
    return this._organizationRepository.getOrgByIdWithSubscription(id);
  }

  getAccountOverview(orgId: string) {
    return this._organizationRepository.getAccountOverview(orgId);
  }

  getOrgByApiKey(api: string) {
    return this._organizationRepository.getOrgByApiKey(api);
  }

  async canUseSuperAdminApi(orgId: string) {
    const [superAdmin, privilegedOther] = await Promise.all([
      this._organizationRepository.getSuperAdminUser(orgId),
      this._organizationRepository.getPrivilegedNonSuperAdminUser(orgId),
    ]);

    return !!superAdmin && !privilegedOther;
  }

  getUserOrg(id: string) {
    return this._organizationRepository.getUserOrg(id);
  }

  getOrgsByUserId(userId: string) {
    return this._organizationRepository.getOrgsByUserId(userId);
  }

  updateApiKey(orgId: string) {
    return this._organizationRepository.updateApiKey(orgId);
  }

  getTeam(orgId: string) {
    return this._organizationRepository.getTeam(orgId);
  }

  getWorkspaceSettings(orgId: string) {
    return this._organizationRepository.getWorkspaceSettings(orgId);
  }

  updateWorkspaceName(orgId: string, name: string) {
    return this._organizationRepository.updateWorkspaceName(orgId, name);
  }

  async setStreak(organizationId: string, type: 'start' | 'end') {
    return this._organizationRepository.setStreak(organizationId, type);
  }

  async getLastPublishDate(organizationId: string) {
    return this._organizationRepository.getLastPublishDate(organizationId);
  }

  getOrgByCustomerId(customerId: string) {
    return this._organizationRepository.getOrgByCustomerId(customerId);
  }

  async createWorkspace(org: WorkspaceContext, user: User, name: string) {
    assertWorkspaceAdmin(org, user);
    return this._organizationRepository.createWorkspace(name, user.id);
  }

  async removeWorkspace(org: WorkspaceContext, user: User, name: string) {
    assertServerOwner(user);
    return this._organizationRepository.removeWorkspace(org.id, name, user.id);
  }

  async changeTeamRole(
    org: WorkspaceContext,
    user: User,
    id: string,
    role: 'USER' | 'ADMIN'
  ) {
    assertServerOwner(user);
    return this._organizationRepository.manageMember(org.id, user, id, role);
  }

  leaveWorkspace(org: WorkspaceContext, user: User) {
    return this._organizationRepository.leaveWorkspace(org.id, user.id);
  }

  validInvitation(
    details: { id: string; orgId: string; role: string; email: string },
    email?: string
  ) {
    return this._organizationRepository.validInvitation(details, email);
  }

  acceptInvitation(
    userId: string,
    details: {
      id: string;
      orgId: string;
      role: 'USER' | 'ADMIN';
      email: string;
    }
  ) {
    return this._organizationRepository.acceptInvitation(userId, details);
  }

  createInvitedUser(
    body: Omit<CreateOrgUserDto, 'providerToken'> & { providerId?: string },
    ip: string,
    agent: string,
    details: {
      id: string;
      orgId: string;
      role: 'USER' | 'ADMIN';
      email: string;
    }
  ) {
    return this._organizationRepository.createInvitedUser(
      body,
      this._notificationsService.hasEmailProvider(),
      ip,
      agent,
      details
    );
  }

  private invitationUrl(invite: {
    id: string;
    organizationId: string;
    role: string;
    email: string;
    expiresAt: Date;
  }) {
    return (
      process.env.FRONTEND_URL +
      '/?org=' +
      AuthService.signJWT({
        purpose: 'team-invitation',
        id: invite.id,
        orgId: invite.organizationId,
        role: invite.role,
        email: invite.email,
        timeLimit: invite.expiresAt.toISOString(),
      })
    );
  }

  private async sendInvitation(
    org: Organization,
    user: User,
    invite: {
      id: string;
      organizationId: string;
      role: string;
      email: string;
      expiresAt: Date;
    }
  ) {
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          }[c]!)
      );
    await this._notificationsService.sendEmail(
      invite.email,
      `${user.name || user.email} invited you to join "${org.name}"`,
      `${escape(user.name || user.email)} has invited you to join the "${escape(
        org.name
      )}" team.<br /><a href="${this.invitationUrl(
        invite
      )}">Accept the invitation</a>.<br />Sign in or register with ${escape(
        invite.email
      )}. The link expires on ${escape(invite.expiresAt.toUTCString())}.`
    );
  }

  async inviteTeamMember(
    org: WorkspaceContext,
    user: User,
    body: AddTeamMemberDto
  ) {
    assertInviteRole(org, user, body.role);
    const invite = await this._organizationRepository.createInvitation({
      id: makeSecureId(32),
      organizationId: org.id,
      email: body.email.trim().toLowerCase(),
      role: body.role as 'USER' | 'ADMIN',
      invitedBy: user.isSuperAdmin
        ? (
            await this._organizationRepository.getSuperAdminUser(org.id)
          )?.userId || user.id
        : user.id,
      expiresAt: dayjs().add(2, 'day').toDate(),
    });
    try {
      if (body.sendEmail) await this.sendInvitation(org, user, invite);
    } catch (error) {
      await this._organizationRepository.revokeInvitation(
        org.id,
        invite.id,
        user.id
      );
      throw new BadRequestException(
        'Invitation email could not be sent. Please try again.'
      );
    }
    return { url: this.invitationUrl(invite) };
  }

  listInvitations(org: WorkspaceContext, user: User) {
    assertWorkspaceAdmin(org, user);
    return this._organizationRepository.listInvitations(org.id);
  }

  async invitationAction(
    org: WorkspaceContext,
    user: User,
    id: string,
    action: 'copy' | 'resend' | 'revoke'
  ) {
    assertWorkspaceAdmin(org, user);
    const invite = await this._organizationRepository.getInvitation(org.id, id);
    if (!invite)
      throw new BadRequestException('Invitation not found in this workspace');
    assertInviteRole(org, user, invite.role);
    if (action === 'revoke')
      return this._organizationRepository.revokeInvitation(org.id, id, user.id);
    if (invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date())
      throw new BadRequestException(
        'Create a new invitation; this invitation has expired or is no longer pending'
      );
    await this.validInvitation({
      id: invite.id,
      orgId: invite.organizationId,
      role: invite.role,
      email: invite.email,
    });
    if (action === 'resend') await this.sendInvitation(org, user, invite);
    return { url: this.invitationUrl(invite) };
  }

  teamAudit(org: WorkspaceContext, user: User) {
    assertWorkspaceAdmin(org, user);
    return this._organizationRepository.teamAudit(org.id);
  }

  async addTeamMemberByEmail(org: Organization, body: AdminAddTeamMemberDto) {
    const tier =
      // @ts-ignore
      org?.subscription?.subscriptionTier ||
      (!process.env.STRIPE_PUBLISHABLE_KEY ? 'ULTIMATE' : 'FREE');

    if (!pricing[tier].team_members) {
      throw new HttpException(
        'The organization plan does not include team members',
        400
      );
    }

    const users = await this._organizationRepository.getUsersByEmail(
      body.email
    );
    if (!users.length) {
      throw new HttpException(
        'No active Socialz account found for this email',
        400
      );
    }

    if (users.length > 1) {
      throw new HttpException(
        'Multiple accounts exist for this email (different login providers)',
        400
      );
    }

    const [user] = users;

    const userOrgs = await this._organizationRepository.getOrgsByUserId(
      user.id
    );
    if (userOrgs.some((current) => current.id === org.id)) {
      throw new HttpException(
        'User is already a member of this organization',
        400
      );
    }

    const added = await this._organizationRepository.addUserToOrg(
      user.id,
      makeId(5),
      org.id,
      body.role as 'USER' | 'ADMIN'
    );

    if (!added) {
      throw new HttpException(
        'Could not add the user to the organization',
        400
      );
    }

    return { added: true };
  }

  deleteTeamMember(org: WorkspaceContext, userId: string, user: User) {
    assertWorkspaceAdmin(org, user);
    return this._organizationRepository.manageMember(org.id, user, userId);
  }

  disableOrEnableNonSuperAdminUsers(orgId: string, disable: boolean) {
    return this._organizationRepository.disableOrEnableNonSuperAdminUsers(
      orgId,
      disable
    );
  }

  getShortlinkPreference(orgId: string) {
    return this._organizationRepository.getShortlinkPreference(orgId);
  }

  updateShortlinkPreference(orgId: string, shortlink: ShortLinkPreference) {
    return this._organizationRepository.updateShortlinkPreference(
      orgId,
      shortlink
    );
  }
}
