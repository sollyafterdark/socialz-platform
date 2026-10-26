import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  Prisma,
  Provider,
  Role,
  ShortLinkPreference,
  SubscriptionTier,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';

@Injectable()
export class OrganizationRepository {
  constructor(
    private _organization: PrismaRepository<'organization'>,
    private _userOrg: PrismaRepository<'userOrganization'>,
    private _user: PrismaRepository<'user'>,
    private _transactions: PrismaTransaction
  ) {}

  createMaxUser(id: string, name: string, saasName: string, email: string) {
    return this._organization.model.organization.create({
      select: {
        id: true,
        apiKey: true,
      },
      data: {
        name: name ? `${name}###${id}` : `Unnamed User###${id}`,
        apiKey: AuthService.fixedEncryption(makeSecureId(20)),
        isTrailing: false,
        subscription: {
          create: {
            totalChannels: 1000000,
            subscriptionTier: 'ULTIMATE',
            isLifetime: true,
            period: 'YEARLY',
          },
        },
        users: {
          create: {
            role: Role.SUPERADMIN,
            user: {
              create: {
                activated: true,
                email: email
                  ? email.split('@').join(`+${saasName}@`)
                  : `${saasName}+` + makeId(10) + '@postiz.com',
                name: name ? `${name}###${id}` : `Unnamed User###${id}`,
                providerName: 'LOCAL',
                password: AuthService.hashPassword(makeSecureId(500)),
                timezone: 0,
              },
            },
          },
        },
      },
    });
  }

  getOrgByApiKey(api: string) {
    return this._organization.model.organization.findFirst({
      where: {
        apiKey: api,
        deletedAt: null,
      },
      include: {
        subscription: {
          select: {
            subscriptionTier: true,
            totalChannels: true,
            isLifetime: true,
          },
        },
      },
    });
  }

  getCount() {
    return this._organization.model.organization.count();
  }

  getWorkspaceSettings(orgId: string) {
    return this._organization.model.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { id: true, name: true },
    });
  }

  updateWorkspaceName(orgId: string, name: string) {
    return this._organization.model.organization.update({
      where: { id: orgId },
      data: { name },
      select: { id: true, name: true },
    });
  }

  getSuperAdminUser(orgId: string) {
    return this._userOrg.model.userOrganization.findFirst({
      where: {
        organizationId: orgId,
        disabled: false,
        user: {
          isSuperAdmin: true,
          deletedAt: null,
        },
      },
    });
  }

  getPrivilegedNonSuperAdminUser(orgId: string) {
    return this._userOrg.model.userOrganization.findFirst({
      where: {
        organizationId: orgId,
        disabled: false,
        role: {
          in: [Role.SUPERADMIN, Role.ADMIN],
        },
        user: {
          isSuperAdmin: false,
          deletedAt: null,
        },
      },
    });
  }

  getUserOrg(id: string) {
    return this._userOrg.model.userOrganization.findFirst({
      where: {
        id,
      },
      select: {
        user: true,
        organization: {
          include: {
            users: {
              select: {
                id: true,
                disabled: true,
                role: true,
                userId: true,
              },
            },
            subscription: {
              select: {
                subscriptionTier: true,
                totalChannels: true,
                isLifetime: true,
              },
            },
          },
        },
      },
    });
  }

  getImpersonateUser(name: string) {
    return this._userOrg.model.userOrganization.findMany({
      where: {
        OR: [
          {
            organizationId: {
              contains: name,
            },
          },
          {
            organization: {
              OR: [
                {
                  paymentId: {
                    equals: name,
                  },
                },
                {
                  subscription: {
                    identifier: {
                      equals: name,
                    },
                  },
                },
                {
                  Integration: {
                    some: {
                      id: name,
                    },
                  },
                },
                {
                  post: {
                    some: {
                      id: name,
                    },
                  },
                },
              ],
            },
          },
          {
            user: {
              OR: [
                {
                  name: {
                    contains: name,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: name,
                    mode: 'insensitive',
                  },
                },
                {
                  id: {
                    contains: name,
                  },
                },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        role: true,
        disabled: true,
        organization: {
          select: {
            id: true,
            name: true,
            paymentId: true,
            deletedAt: true,
            subscription: {
              select: {
                subscriptionTier: true,
                identifier: true,
                isLifetime: true,
                period: true,
                cancelAt: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            activated: true,
            providerName: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  updateApiKey(orgId: string) {
    return this._organization.model.organization.update({
      where: {
        id: orgId,
      },
      data: {
        apiKey: AuthService.fixedEncryption(makeSecureId(20)),
      },
    });
  }

  async getOrgsByUserId(userId: string) {
    return this._organization.model.organization.findMany({
      where: {
        deletedAt: null,
        users: {
          some: {
            userId,
          },
        },
      },
      include: {
        users: {
          where: {
            userId,
          },
          select: {
            disabled: true,
            role: true,
          },
        },
        subscription: {
          select: {
            subscriptionTier: true,
            totalChannels: true,
            isLifetime: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getOrgById(id: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id,
      },
    });
  }

  getOrgByIdWithSubscription(id: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id,
      },
      include: {
        subscription: {
          select: {
            subscriptionTier: true,
            totalChannels: true,
            isLifetime: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getAccountOverview(orgId: string) {
    const [organization, members] = await Promise.all([
      this._organization.model.organization.findUnique({
        where: {
          id: orgId,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          deletedAt: true,
          allowTrial: true,
          isTrailing: true,
          subscription: {
            select: {
              subscriptionTier: true,
              period: true,
              identifier: true,
              totalChannels: true,
              isLifetime: true,
              cancelAt: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
            },
          },
        },
      }),
      this._userOrg.model.userOrganization.findMany({
        where: {
          organizationId: orgId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          role: true,
          disabled: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              activated: true,
              providerName: true,
              lastOnline: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    if (!organization) {
      return null;
    }

    const owner = members.find((member) => member.role === Role.SUPERADMIN);
    const lastOnlineMax = members.reduce<Date | null>(
      (latest, member) =>
        !latest || member.user.lastOnline > latest
          ? member.user.lastOnline
          : latest,
      null
    );

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt,
        deletedAt: organization.deletedAt,
        allowTrial: organization.allowTrial,
        isTrailing: organization.isTrailing,
      },
      subscription: organization.subscription || null,
      owner: owner
        ? {
            ...owner.user,
            role: owner.role,
            memberSince: owner.createdAt,
          }
        : null,
      users: {
        total: members.length,
        activated: members.filter((member) => member.user.activated).length,
        disabled: members.filter((member) => member.disabled).length,
        lastOnlineMax,
      },
    };
  }

  getUsersByEmail(email: string) {
    return this._user.model.user.findMany({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        deletedAt: null,
        activated: true,
      },
    });
  }

  private async createMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    orgId: string,
    role: 'USER' | 'ADMIN'
  ) {
    const org = await tx.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: { subscription: true },
    });
    if (
      !org ||
      (process.env.STRIPE_PUBLISHABLE_KEY &&
        org.subscription?.subscriptionTier === SubscriptionTier.STANDARD)
    ) {
      throw new BadRequestException('This workspace cannot accept members');
    }
    const member = await tx.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (member) return false; // An invitation never changes an existing role.
    return tx.userOrganization.create({
      data: { role, userId, organizationId: orgId },
    });
  }

  async addUserToOrg(
    userId: string,
    id: string,
    orgId: string,
    role: 'USER' | 'ADMIN'
  ) {
    return this._transactions.model.$transaction(async (tx) => {
      const member = await this.createMembership(tx, userId, id, orgId, role);
      if (member)
        await tx.teamAudit.create({
          data: {
            organizationId: orgId,
            actorId: userId,
            action: 'MEMBER_ADDED',
            target:
              (
                await tx.user.findUnique({
                  where: { id: userId },
                  select: { email: true },
                })
              )?.email || userId,
          },
        });
      return member;
    });
  }

  async validInvitation(
    details: { id: string; orgId: string; role: string; email: string },
    email?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db =
      tx || (this._transactions.model as unknown as Prisma.TransactionClient);
    // PrismaTransaction exposes the same client; use a transaction when no client was passed.
    if (!tx)
      return this._transactions.model.$transaction((inner) =>
        this.validInvitation(details, email, inner)
      );
    const invite = await db.teamInvitation.findFirst({
      where: {
        id: details.id,
        organizationId: details.orgId,
        role: details.role as Role,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        organization: { deletedAt: null },
      },
    });
    if (
      !invite ||
      invite.email !== details.email?.trim().toLowerCase() ||
      (email && invite.email !== email.trim().toLowerCase())
    ) {
      throw new BadRequestException(
        'Invitation is expired, revoked, already used, or belongs to another email address'
      );
    }
    const issuer = await db.user.findFirst({
      where: { id: invite.invitedBy, activated: true, deletedAt: null },
      include: {
        organizations: {
          where: { organizationId: invite.organizationId, disabled: false },
        },
      },
    });
    if (
      !issuer ||
      (!issuer.isSuperAdmin &&
        (invite.role === 'ADMIN' ||
          !issuer.organizations.some((m) =>
            ['ADMIN', 'SUPERADMIN'].includes(m.role)
          )))
    ) {
      throw new BadRequestException(
        'The invitation sender no longer has permission to invite this role'
      );
    }
    return invite;
  }

  async acceptInvitation(
    userId: string,
    details: {
      id: string;
      orgId: string;
      role: 'USER' | 'ADMIN';
      email: string;
    }
  ) {
    return this._transactions.model.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, activated: true, deletedAt: null },
      });
      if (!user)
        throw new BadRequestException(
          'Activate your account before joining a workspace'
        );
      const invite = await this.validInvitation(details, user.email, tx);
      const claimed = await tx.teamInvitation.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedBy: userId },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Invitation has already been used');
      const member = await this.createMembership(
        tx,
        userId,
        invite.id,
        invite.organizationId,
        invite.role as 'USER' | 'ADMIN'
      );
      await tx.teamAudit.create({
        data: {
          organizationId: invite.organizationId,
          actorId: userId,
          action: 'INVITATION_ACCEPTED',
          target:
            (
              await tx.user.findUnique({
                where: { id: userId },
                select: { email: true },
              })
            )?.email || userId,
        },
      });
      return member || { organizationId: invite.organizationId };
    });
  }

  async createInvitedUser(
    body: Omit<CreateOrgUserDto, 'providerToken'> & { providerId?: string },
    hasEmail: boolean,
    ip: string,
    agent: string,
    details: {
      id: string;
      orgId: string;
      role: 'USER' | 'ADMIN';
      email: string;
    }
  ) {
    // Account creation, single-use invitation claim and membership commit together. Local login still requires email activation.
    return this._transactions.model.$transaction(async (tx) => {
      await this.validInvitation(details, body.email, tx);
      const user = await tx.user.create({
        data: {
          email: body.email.trim().toLowerCase(),
          password: body.password
            ? AuthService.hashPassword(body.password)
            : '',
          providerName: body.provider,
          providerId: body.providerId || '',
          activated: body.provider !== Provider.LOCAL || !hasEmail,
          timezone: 0,
          ip,
          agent,
        },
      });
      const claimed = await tx.teamInvitation.updateMany({
        where: {
          id: details.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedBy: user.id },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Invitation has already been used');
      const membership = await this.createMembership(
        tx,
        user.id,
        details.id,
        details.orgId,
        details.role
      );
      await tx.teamAudit.create({
        data: {
          organizationId: details.orgId,
          actorId: user.id,
          action: 'INVITATION_ACCEPTED',
          target: user.email,
        },
      });
      return { user, membership };
    });
  }

  createInvitation(data: Prisma.TeamInvitationUncheckedCreateInput) {
    return this._transactions.model.$transaction(async (tx) => {
      const invite = await tx.teamInvitation.create({ data });
      await tx.teamAudit.create({
        data: {
          organizationId: invite.organizationId,
          actorId: invite.invitedBy,
          action: 'INVITATION_CREATED',
          target: invite.email + ':' + invite.role,
        },
      });
      return invite;
    });
  }

  listInvitations(orgId: string) {
    return this._transactions.model.$transaction((tx) =>
      tx.teamInvitation.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      })
    );
  }

  getInvitation(orgId: string, id: string) {
    return this._transactions.model.$transaction((tx) =>
      tx.teamInvitation.findFirst({ where: { id, organizationId: orgId } })
    );
  }

  revokeInvitation(orgId: string, id: string, actorId: string) {
    return this._transactions.model.$transaction(async (tx) => {
      const result = await tx.teamInvitation.updateMany({
        where: { id, organizationId: orgId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count)
        await tx.teamAudit.create({
          data: {
            organizationId: orgId,
            actorId,
            action: 'INVITATION_REVOKED',
            target: id,
          },
        });
      return { revoked: result.count > 0 };
    });
  }

  teamAudit(orgId: string) {
    return this._transactions.model.$transaction((tx) =>
      tx.teamAudit.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          target: true,
          actorId: true,
          createdAt: true,
        },
      })
    );
  }

  async createWorkspace(name: string, creatorId: string) {
    return this._transactions.model.$transaction(async (tx) => {
      const owners = await tx.user.findMany({
        where: { isSuperAdmin: true, activated: true, deletedAt: null },
        select: { id: true },
      });
      if (owners.length !== 1)
        throw new BadRequestException(
          'Contact the Socialz owner to create this workspace'
        );
      const ownerId = owners[0].id;
      const workspace = await tx.organization.create({
        data: {
          name,
          apiKey: AuthService.fixedEncryption(makeSecureId(20)),
          users: {
            create: [
              { userId: ownerId, role: Role.SUPERADMIN },
              ...(creatorId === ownerId
                ? []
                : [{ userId: creatorId, role: Role.ADMIN }]),
            ],
          },
        },
        select: { id: true, name: true },
      });
      await tx.teamAudit.create({
        data: {
          organizationId: workspace.id,
          actorId: creatorId,
          action: 'WORKSPACE_CREATED',
        },
      });
      return workspace;
    });
  }

  async manageMember(
    orgId: string,
    actor: { id: string; isSuperAdmin: boolean },
    targetId: string,
    role?: 'USER' | 'ADMIN'
  ) {
    return this._transactions.model.$transaction(async (tx) => {
      const target = await tx.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId: targetId, organizationId: orgId },
        },
        include: { user: { select: { isSuperAdmin: true, email: true } } },
      });
      if (!target)
        throw new BadRequestException('User is not a member of this workspace');
      if (target.user.isSuperAdmin || target.role === 'SUPERADMIN')
        throw new ForbiddenException(
          'The Socialz owner cannot be removed or demoted'
        );
      if (targetId === actor.id)
        throw new ForbiddenException(
          'Use Leave workspace to remove your own membership'
        );
      if (!actor.isSuperAdmin) {
        const member = await tx.userOrganization.findUnique({
          where: {
            userId_organizationId: { userId: actor.id, organizationId: orgId },
          },
        });
        if (
          role ||
          !member ||
          member.disabled ||
          !['ADMIN', 'SUPERADMIN'].includes(member.role) ||
          target.role !== 'USER'
        )
          throw new ForbiddenException(
            'Only the Socialz owner can manage administrators'
          );
      }
      if (role)
        await tx.userOrganization.update({
          where: { id: target.id },
          data: { role },
        });
      else await tx.userOrganization.delete({ where: { id: target.id } });
      await tx.teamAudit.create({
        data: {
          organizationId: orgId,
          actorId: actor.id,
          action: role ? 'ROLE_CHANGED' : 'MEMBER_REMOVED',
          target: target.user.email + (role ? ':' + role : ''),
        },
      });
      return { updated: true };
    });
  }

  async leaveWorkspace(orgId: string, userId: string) {
    return this._transactions.model.$transaction(
      async (tx) => {
        const membership = await tx.userOrganization.findUnique({
          where: { userId_organizationId: { userId, organizationId: orgId } },
          include: { user: { select: { isSuperAdmin: true, email: true } } },
        });
        if (
          !membership ||
          membership.role === 'SUPERADMIN' ||
          membership.user.isSuperAdmin
        )
          throw new ForbiddenException(
            'The Socialz owner must remain in this workspace'
          );
        const others = await tx.userOrganization.count({
          where: {
            userId,
            organizationId: { not: orgId },
            disabled: false,
            organization: { deletedAt: null },
          },
        });
        if (!others)
          throw new BadRequestException(
            'You must belong to another workspace before leaving this one'
          );
        await tx.userOrganization.delete({ where: { id: membership.id } });
        await tx.teamAudit.create({
          data: {
            organizationId: orgId,
            actorId: userId,
            action: 'MEMBER_LEFT',
            target:
              (
                await tx.user.findUnique({
                  where: { id: userId },
                  select: { email: true },
                })
              )?.email || userId,
          },
        });
        return { left: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async removeWorkspace(orgId: string, name: string, actorId: string) {
    return this._transactions.model.$transaction(
      async (tx) => {
        const org = await tx.organization.findFirst({
          where: { id: orgId, deletedAt: null },
        });
        if (!org || org.name !== name)
          throw new BadRequestException(
            'Type the exact workspace name to confirm deletion'
          );
        const others = await tx.userOrganization.count({
          where: {
            userId: actorId,
            organizationId: { not: orgId },
            disabled: false,
            organization: { deletedAt: null },
          },
        });
        if (!others)
          throw new BadRequestException(
            'Your final workspace cannot be deleted'
          );
        if (
          (await tx.post.count({
            where: {
              organizationId: orgId,
              deletedAt: null,
              OR: [{ state: 'QUEUE' }, { intervalInDays: { not: null } }],
            },
          })) ||
          (await tx.autoPost.count({
            where: { organizationId: orgId, deletedAt: null, active: true },
          }))
        ) {
          throw new BadRequestException(
            'Cancel scheduled and repeating posts and disable auto-posting before deleting this workspace'
          );
        }
        const members = await tx.userOrganization.findMany({
          where: { organizationId: orgId, disabled: false },
        });
        for (const member of members) {
          if (
            !(await tx.userOrganization.count({
              where: {
                userId: member.userId,
                organizationId: { not: orgId },
                disabled: false,
                organization: { deletedAt: null },
              },
            }))
          )
            throw new BadRequestException(
              'Every member must join another workspace before this workspace can be deleted'
            );
        }
        const now = new Date();
        await tx.integration.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { disabled: true, deletedAt: now },
        });
        await tx.autoPost.updateMany({
          where: { organizationId: orgId, deletedAt: null },
          data: { active: false, deletedAt: now },
        });
        await tx.teamInvitation.updateMany({
          where: { organizationId: orgId, acceptedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.organization.update({
          where: { id: orgId },
          data: { deletedAt: now },
        });
        await tx.teamAudit.create({
          data: {
            organizationId: orgId,
            actorId,
            action: 'WORKSPACE_DELETED',
            target: name,
          },
        });
        return { deleted: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async createOrgAndUser(
    body: Omit<CreateOrgUserDto, 'providerToken'> & { providerId?: string },
    hasEmail: boolean,
    ip: string,
    userAgent: string
  ) {
    return this._organization.model.organization.create({
      data: {
        name: body.company,
        apiKey: AuthService.fixedEncryption(makeSecureId(20)),
        allowTrial: true,
        isTrailing: true,
        users: {
          create: {
            role: Role.SUPERADMIN,
            user: {
              create: {
                activated: body.provider !== 'LOCAL' || !hasEmail,
                email: body.email,
                password: body.password
                  ? AuthService.hashPassword(body.password)
                  : '',
                providerName: body.provider,
                providerId: body.providerId || '',
                timezone: 0,
                ip,
                agent: userAgent,
              },
            },
          },
        },
      },
      select: {
        id: true,
        users: {
          select: {
            user: true,
          },
        },
      },
    });
  }

  getOrgByCustomerId(customerId: string) {
    return this._organization.model.organization.findFirst({
      where: {
        paymentId: customerId,
      },
    });
  }

  async setStreak(organizationId: string, type: 'start' | 'end') {
    try {
      await this._organization.model.organization.update({
        where: {
          id: organizationId,
          ...(type === 'start'
            ? {
                streakSince: null,
              }
            : {}),
        },
        data: {
          ...(type === 'end' ? { streakSince: null } : {}),
          ...(type === 'start' ? { streakSince: new Date() } : {}),
        },
      });
    } catch (err) {}
  }

  async getLastPublishDate(organizationId: string) {
    const org = await this._organization.model.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        post: {
          where: {
            state: 'PUBLISHED',
          },
          orderBy: {
            publishDate: 'desc',
          },
          take: 1,
          select: {
            publishDate: true,
          },
        },
      },
    });

    const publishDate = org?.post?.[0]?.publishDate;
    // Never in the future, the streak workflow sleeps until a day after it
    return publishDate ? Math.min(publishDate.getTime(), Date.now()) : null;
  }

  async getTeam(orgId: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id: orgId,
      },
      select: {
        users: {
          where: { disabled: false, user: { deletedAt: null } },
          select: {
            role: true,
            user: {
              select: {
                email: true,
                id: true,
                isSuperAdmin: true,
                sendSuccessEmails: true,
                sendFailureEmails: true,
                sendStreakEmails: true,
              },
            },
          },
        },
      },
    });
  }

  getAllUsersOrgs(orgId: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id: orgId,
      },
      select: {
        users: {
          select: {
            user: {
              select: {
                email: true,
                id: true,
                sendSuccessEmails: true,
                sendFailureEmails: true,
              },
            },
          },
        },
      },
    });
  }

  deleteOrganization(orgId: string) {
    return this._organization.model.organization.update({
      where: {
        id: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async deleteTeamMember(orgId: string, userId: string) {
    return this._userOrg.model.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
    });
  }

  disableOrEnableNonSuperAdminUsers(orgId: string, disable: boolean) {
    return this._userOrg.model.userOrganization.updateMany({
      where: {
        organizationId: orgId,
        role: {
          not: Role.SUPERADMIN,
        },
      },
      data: {
        disabled: disable,
      },
    });
  }

  getShortlinkPreference(orgId: string) {
    return this._organization.model.organization.findUnique({
      where: {
        id: orgId,
      },
      select: {
        shortlink: true,
      },
    });
  }

  updateShortlinkPreference(orgId: string, shortlink: ShortLinkPreference) {
    return this._organization.model.organization.update({
      where: {
        id: orgId,
      },
      data: {
        shortlink,
      },
    });
  }
}
