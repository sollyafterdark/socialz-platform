import { PrismaClient, Role, Provider } from '@prisma/client';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({ NotificationService: class {} })
);

const enabled = process.env.SOCIALZ_TEAM_TEST_DB === 'true';
(enabled ? describe : describe.skip)(
  'team management with isolated PostgreSQL',
  () => {
    const db = new PrismaClient();
    const repo = new OrganizationRepository(
      { model: db } as any,
      { model: db } as any,
      { model: db } as any,
      { model: db } as any
    );
    const sendEmail = jest.fn(async () => {});
    const service = new OrganizationService(repo, {
      hasEmailProvider: () => true,
      sendEmail,
    } as any);
    let owner: any,
      admin: any,
      peer: any,
      member: any,
      wrong: any,
      org: any,
      other: any;
    const context = (role: Role = 'SUPERADMIN') => ({
      ...org,
      users: [{ role }],
    });
    const details = (url: string) =>
      AuthService.verifyJWT(new URL(url).searchParams.get('org')!) as any;
    beforeAll(async () => {
      if (new URL(process.env.DATABASE_URL!).pathname !== '/socialz_team_test')
        throw new Error('Refusing to use a non-test database');
      process.env.JWT_SECRET = 'isolated-socialz-team-test-secret';
      process.env.FRONTEND_URL = 'https://socialz.example.test';
      delete process.env.STRIPE_PUBLISHABLE_KEY;
      await db.$connect();
    });
    afterAll(() => db.$disconnect());
    beforeEach(async () => {
      await db.$executeRawUnsafe(
        'TRUNCATE "TeamAudit", "TeamInvitation", "Organization", "User" CASCADE'
      );
      sendEmail.mockClear();
      const user = (email: string, isSuperAdmin = false) =>
        db.user.create({
          data: {
            email,
            providerName: 'LOCAL',
            timezone: 0,
            isSuperAdmin,
            activated: true,
          },
        });
      owner = await user('owner@example.test', true);
      admin = await user('admin@example.test');
      peer = await user('peer@example.test');
      member = await user('member@example.test');
      wrong = await user('wrong@example.test');
      org = await repo.createWorkspace('Team A', owner.id);
      other = await repo.createWorkspace('Team B', owner.id);
      for (const [u, role] of [
        [admin, 'ADMIN'],
        [peer, 'ADMIN'],
        [member, 'USER'],
      ] as const)
        await repo.addUserToOrg(u.id, u.id, org.id, role);
    });
    it('keeps the sole server owner as owner when an Admin creates a workspace', async () => {
      const created = await service.createWorkspace(
        context('ADMIN'),
        admin,
        'Admin team'
      );
      const memberships = await db.userOrganization.findMany({
        where: { organizationId: created.id },
      });
      expect(memberships.map((m) => [m.userId, m.role])).toEqual(
        expect.arrayContaining([
          [owner.id, 'SUPERADMIN'],
          [admin.id, 'ADMIN'],
        ])
      );
      expect(await db.user.count({ where: { isSuperAdmin: true } })).toBe(1);
      await expect(
        service.createWorkspace(context('USER'), member, 'Forbidden')
      ).rejects.toThrow();
    });
    it('only the owner can promote or demote an Admin, scoped to this workspace', async () => {
      await expect(
        service.changeTeamRole(context('ADMIN'), admin, member.id, 'ADMIN')
      ).rejects.toThrow();
      await service.changeTeamRole(context(), owner, member.id, 'ADMIN');
      await service.changeTeamRole(context(), owner, member.id, 'USER');
      await expect(
        service.changeTeamRole(
          { ...other, users: [{ role: 'SUPERADMIN' }] },
          owner,
          member.id,
          'ADMIN'
        )
      ).rejects.toThrow();
      expect(
        (
          await db.userOrganization.findUnique({
            where: {
              userId_organizationId: {
                userId: member.id,
                organizationId: org.id,
              },
            },
          })
        )?.role
      ).toBe('USER');
    });
    it('protects the owner from demotion and removal', async () => {
      await expect(
        service.changeTeamRole(context(), owner, owner.id, 'USER')
      ).rejects.toThrow('owner');
      await expect(
        service.deleteTeamMember(context(), owner.id, owner)
      ).rejects.toThrow('owner');
      await expect(
        service.deleteTeamMember(context('ADMIN'), owner.id, admin)
      ).rejects.toThrow('owner');
    });
    it('blocks USER peer removal and ADMIN peer removal at the repository boundary', async () => {
      await expect(
        repo.manageMember(org.id, member, wrong.id)
      ).rejects.toThrow();
      await expect(repo.manageMember(org.id, admin, peer.id)).rejects.toThrow();
      await expect(
        repo.manageMember(org.id, member, peer.id)
      ).rejects.toThrow();
      await repo.manageMember(org.id, admin, member.id);
      expect(
        await db.user.findUnique({ where: { id: member.id } })
      ).not.toBeNull();
    });
    it('lets the owner remove an Admin without deleting their account or other memberships', async () => {
      await repo.addUserToOrg(admin.id, 'another', other.id, 'USER');
      await service.deleteTeamMember(context(), admin.id, owner);
      expect(
        await db.userOrganization.count({ where: { userId: admin.id } })
      ).toBe(1);
      expect(
        await db.user.findUnique({ where: { id: admin.id } })
      ).not.toBeNull();
    });
    it('rejects ADMIN invitations from an Admin and every invitation from a User', async () => {
      await expect(
        service.inviteTeamMember(context('ADMIN'), admin, {
          email: wrong.email,
          role: 'ADMIN',
          sendEmail: false,
        })
      ).rejects.toThrow();
      await expect(
        service.inviteTeamMember(context('USER'), member, {
          email: wrong.email,
          role: 'USER',
          sendEmail: false,
        })
      ).rejects.toThrow();
      expect(await db.teamInvitation.count()).toBe(0);
    });
    it('binds one-time links to an email and does not change existing member roles', async () => {
      const invite = details(
        (
          await service.inviteTeamMember(context(), owner, {
            email: wrong.email,
            role: 'USER',
            sendEmail: false,
          })
        ).url
      );
      await expect(service.acceptInvitation(member.id, invite)).rejects.toThrow(
        'email'
      );
      await service.acceptInvitation(wrong.id, invite);
      await expect(
        service.acceptInvitation(wrong.id, invite)
      ).rejects.toThrow();
      expect(await db.user.count({ where: { isSuperAdmin: true } })).toBe(1);
      const ownerInvite = details(
        (
          await service.inviteTeamMember(context(), owner, {
            email: owner.email,
            role: 'USER',
            sendEmail: false,
          })
        ).url
      );
      await service.acceptInvitation(owner.id, ownerInvite);
      expect(
        (
          await db.userOrganization.findUnique({
            where: {
              userId_organizationId: {
                userId: owner.id,
                organizationId: org.id,
              },
            },
          })
        )?.role
      ).toBe('SUPERADMIN');
    });
    it('allows only one concurrent acceptance of the same invitation', async () => {
      const invite = details(
        (
          await service.inviteTeamMember(context(), owner, {
            email: wrong.email,
            role: 'USER',
            sendEmail: false,
          })
        ).url
      );
      const results = await Promise.allSettled([
        service.acceptInvitation(wrong.id, invite),
        service.acceptInvitation(wrong.id, invite),
      ]);
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(
        await db.userOrganization.count({
          where: { userId: wrong.id, organizationId: org.id },
        })
      ).toBe(1);
    });
    it('rejects expired, revoked, tampered, and demoted-sender invitations', async () => {
      for (const kind of ['expired', 'revoked', 'tampered', 'demoted']) {
        const invite = details(
          (
            await service.inviteTeamMember(context('ADMIN'), admin, {
              email: wrong.email,
              role: 'USER',
              sendEmail: false,
            })
          ).url
        );
        if (kind === 'expired')
          await db.teamInvitation.update({
            where: { id: invite.id },
            data: { expiresAt: new Date(0) },
          });
        if (kind === 'revoked')
          await service.invitationAction(context(), owner, invite.id, 'revoke');
        if (kind === 'tampered') invite.role = 'ADMIN';
        if (kind === 'demoted')
          await service.changeTeamRole(context(), owner, admin.id, 'USER');
        await expect(
          service.acceptInvitation(wrong.id, invite)
        ).rejects.toThrow();
      }
    });
    it('prevents invitation actions against another workspace', async () => {
      const invite = details(
        (
          await service.inviteTeamMember(context(), owner, {
            email: wrong.email,
            role: 'USER',
            sendEmail: false,
          })
        ).url
      );
      await expect(
        service.invitationAction(
          { ...other, users: [{ role: 'SUPERADMIN' }] },
          owner,
          invite.id,
          'copy'
        )
      ).rejects.toThrow();
      expect(
        await service.listInvitations(
          { ...other, users: [{ role: 'SUPERADMIN' }] },
          owner
        )
      ).toEqual([]);
    });
    it('uses the native email sender and revokes an invite after a delivery failure', async () => {
      await service.inviteTeamMember(context(), owner, {
        email: wrong.email,
        role: 'USER',
        sendEmail: true,
      });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      sendEmail.mockRejectedValueOnce(new Error('delivery error'));
      await expect(
        service.inviteTeamMember(context(), owner, {
          email: wrong.email,
          role: 'USER',
          sendEmail: true,
        })
      ).rejects.toThrow('email');
      expect(
        await db.teamInvitation.count({ where: { revokedAt: { not: null } } })
      ).toBe(1);
    });
    it('creates invited accounts without another owner or personal workspace and requires activation', async () => {
      const invite = details(
        (
          await service.inviteTeamMember(context(), owner, {
            email: 'new@example.test',
            role: 'ADMIN',
            sendEmail: false,
          })
        ).url
      );
      const before = await db.organization.count();
      const result = await service.createInvitedUser(
        {
          email: 'new@example.test',
          password: 'example-test-password',
          provider: Provider.LOCAL,
          company: 'unused',
          datafast_visitor_id: '',
        },
        '127.0.0.1',
        'test',
        invite
      );
      expect(result.user.activated).toBe(false);
      expect(result.user.isSuperAdmin).toBe(false);
      expect(result.membership && result.membership.role).toBe('ADMIN');
      expect(await db.organization.count()).toBe(before);
      expect(await db.user.count({ where: { isSuperAdmin: true } })).toBe(1);
    });
    it('protects final memberships and lets a non-owner leave when they have another workspace', async () => {
      await expect(
        service.leaveWorkspace(context('USER'), member)
      ).rejects.toThrow('another workspace');
      await expect(service.leaveWorkspace(context(), owner)).rejects.toThrow(
        'owner'
      );
      await repo.addUserToOrg(member.id, 'second', other.id, 'USER');
      await service.leaveWorkspace(context('USER'), member);
      expect(
        await db.userOrganization.count({ where: { userId: member.id } })
      ).toBe(1);
    });
    it('requires owner access, exact name, and another workspace for each member before deletion', async () => {
      await expect(
        service.removeWorkspace(context('ADMIN'), admin, 'Team A')
      ).rejects.toThrow();
      await expect(
        service.removeWorkspace(context(), owner, 'wrong')
      ).rejects.toThrow();
      await expect(
        service.removeWorkspace(context(), owner, 'Team A')
      ).rejects.toThrow('Every member');
      await expect(
        service.removeWorkspace(
          { ...other, users: [{ role: 'SUPERADMIN' }] },
          owner,
          'Team B'
        )
      ).resolves.toEqual({ deleted: true });
      await expect(
        service.removeWorkspace(context(), owner, 'Team A')
      ).rejects.toThrow('final workspace');
    });
    it('records membership and invitation changes without logging tokens', async () => {
      await service.inviteTeamMember(context(), owner, {
        email: wrong.email,
        role: 'USER',
        sendEmail: false,
      });
      await service.changeTeamRole(context(), owner, member.id, 'ADMIN');
      const audit = await service.teamAudit(context(), owner);
      expect(audit.some((x) => x.action === 'ROLE_CHANGED')).toBe(true);
      expect(audit.some((x) => x.action === 'INVITATION_CREATED')).toBe(true);
      expect(JSON.stringify(audit)).not.toContain('eyJ');
    });
    it('blocks deletion while scheduled, repeating, or automatic posts can still publish', async () => {
      const integration = await db.integration.create({
        data: {
          internalId: 'test-channel',
          organizationId: other.id,
          name: 'Test channel',
          providerIdentifier: 'telegram',
          type: 'social',
          token: 'isolated-test-token',
        },
      });
      const post = await db.post.create({
        data: {
          publishDate: new Date(Date.now() + 60000),
          organizationId: other.id,
          integrationId: integration.id,
          content: 'Test',
          group: 'test-group',
          state: 'QUEUE',
        },
      });
      const selected = { ...other, users: [{ role: 'SUPERADMIN' as const }] };
      await expect(
        service.removeWorkspace(selected, owner, 'Team B')
      ).rejects.toThrow('Cancel scheduled');
      await db.post.update({
        where: { id: post.id },
        data: { state: 'PUBLISHED', intervalInDays: 2 },
      });
      await expect(
        service.removeWorkspace(selected, owner, 'Team B')
      ).rejects.toThrow('Cancel scheduled');
      await db.post.update({
        where: { id: post.id },
        data: { intervalInDays: null },
      });
      const auto = await db.autoPost.create({
        data: {
          organizationId: other.id,
          title: 'Test feed',
          url: 'https://example.test/feed',
          lastUrl: '',
          active: true,
          addPicture: false,
          generateContent: false,
          integrations: '[]',
          onSlot: false,
          syncLast: false,
        },
      });
      await expect(
        service.removeWorkspace(selected, owner, 'Team B')
      ).rejects.toThrow('Cancel scheduled');
      await db.autoPost.update({
        where: { id: auto.id },
        data: { active: false },
      });
      await service.removeWorkspace(selected, owner, 'Team B');
      expect(
        (await db.integration.findUnique({ where: { id: integration.id } }))
          ?.disabled
      ).toBe(true);
      expect(
        (await db.integration.findUnique({ where: { id: integration.id } }))
          ?.deletedAt
      ).not.toBeNull();
      expect(
        (await db.organization.findUnique({ where: { id: org.id } }))?.deletedAt
      ).toBeNull();
      expect(
        await db.post.findUnique({ where: { id: post.id } })
      ).not.toBeNull();
    });

    it('keeps the last owner workspace under concurrent deletions', async () => {
      for (const current of [admin, peer, member])
        await repo.addUserToOrg(
          current.id,
          current.id + '-second',
          other.id,
          'USER'
        );
      const results = await Promise.allSettled([
        service.removeWorkspace(context(), owner, 'Team A'),
        service.removeWorkspace(
          { ...other, users: [{ role: 'SUPERADMIN' }] },
          owner,
          'Team B'
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1);
      expect(
        await db.organization.count({
          where: { deletedAt: null, users: { some: { userId: owner.id } } },
        })
      ).toBe(1);
    });
  }
);
