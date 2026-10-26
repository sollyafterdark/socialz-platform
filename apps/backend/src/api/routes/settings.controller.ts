import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, Role, User } from '@prisma/client';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { ShortlinkPreferenceDto } from '@gitroom/nestjs-libraries/dtos/settings/shortlink-preference.dto';
import { WorkspaceSettingsDto } from '@gitroom/nestjs-libraries/dtos/settings/workspace-settings.dto';
import {
  TeamRoleDto,
  DeleteWorkspaceDto,
} from '@gitroom/nestjs-libraries/dtos/settings/team-management.dto';
import { assertWorkspaceAdmin } from '@gitroom/nestjs-libraries/database/prisma/organizations/workspace-access';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('Settings')
@Controller('/settings')
export class SettingsController {
  constructor(private _organizationService: OrganizationService) {}

  @Get('/workspace')
  getWorkspace(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getWorkspaceSettings(org.id);
  }

  @Put('/workspace')
  updateWorkspace(
    @GetOrgFromRequest() org: Organization & { users: { role: Role }[] },
    @GetUserFromRequest() user: User,
    @Body() body: WorkspaceSettingsDto
  ) {
    // Self-hosted installs bypass plan policies; enforce the role here too.
    const role = org.users?.[0]?.role;
    if (!user.isSuperAdmin && role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException(
        'Only workspace admins can rename this workspace'
      );
    }

    return this._organizationService.updateWorkspaceName(org.id, body.name);
  }

  @Get('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async getTeam(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User
  ) {
    assertWorkspaceAdmin(org, user);
    return this._organizationService.getTeam(org.id);
  }

  @Post('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async inviteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: AddTeamMemberDto
  ) {
    return this._organizationService.inviteTeamMember(org, user, body);
  }

  @Post('/team/add')
  async addTeamMember(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AdminAddTeamMemberDto
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }

    return this._organizationService.addTeamMemberByEmail(org, body);
  }

  @Delete('/team/:id')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  deleteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @GetUserFromRequest() user: User
  ) {
    return this._organizationService.deleteTeamMember(org, id, user);
  }

  @Post('/workspaces')
  createWorkspace(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: WorkspaceSettingsDto
  ) {
    return this._organizationService.createWorkspace(org, user, body.name);
  }

  @Delete('/workspace')
  deleteWorkspace(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: DeleteWorkspaceDto
  ) {
    return this._organizationService.removeWorkspace(org, user, body.name);
  }

  @Put('/team/:id/role')
  changeTeamRole(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: TeamRoleDto
  ) {
    return this._organizationService.changeTeamRole(org, user, id, body.role);
  }

  @Post('/workspace/leave')
  leaveWorkspace(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User
  ) {
    return this._organizationService.leaveWorkspace(org, user);
  }

  @Get('/team/invitations')
  listInvitations(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User
  ) {
    return this._organizationService.listInvitations(org, user);
  }

  @Post('/team/invitations/:id/:action')
  invitationAction(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Param('action') action: string
  ) {
    if (!['copy', 'resend', 'revoke'].includes(action))
      throw new HttpException('Unknown invitation action', 400);
    return this._organizationService.invitationAction(
      org,
      user,
      id,
      action as 'copy' | 'resend' | 'revoke'
    );
  }

  @Get('/team/audit')
  teamAudit(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User
  ) {
    return this._organizationService.teamAudit(org, user);
  }

  @Get('/shortlink')
  async getShortlinkPreference(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getShortlinkPreference(org.id);
  }

  @Post('/shortlink')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async updateShortlinkPreference(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ShortlinkPreferenceDto
  ) {
    return this._organizationService.updateShortlinkPreference(
      org.id,
      body.shortlink
    );
  }
}
