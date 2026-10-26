import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({ NotificationService: class {} })
);

describe('self-hosted team HTTP boundaries', () => {
  let app: INestApplication, base: string, role: string, owner: boolean;
  const repo = {
    getTeam: jest.fn(async () => ({ users: [] })),
    createWorkspace: jest.fn(async (name, id) => ({ id: 'created', name })),
    removeWorkspace: jest.fn(async () => ({ deleted: true })),
    manageMember: jest.fn(async () => ({ updated: true })),
    createInvitation: jest.fn(async (data) => data),
    listInvitations: jest.fn(async () => []),
    teamAudit: jest.fn(async () => []),
    leaveWorkspace: jest.fn(async () => ({ left: true })),
  };
  const notification = { sendEmail: jest.fn(), hasEmailProvider: () => true };
  beforeAll(async () => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.JWT_SECRET = 'http-team-test-secret';
    process.env.FRONTEND_URL = 'https://example.test';
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: OrganizationService,
          useValue: new OrganizationService(repo as any, notification as any),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _: any, next: () => void) => {
      req.user = {
        id: 'actor',
        email: 'actor@example.test',
        isSuperAdmin: owner,
      };
      req.org = { id: 'workspace-a', name: 'Team A', users: [{ role }] };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    role = 'ADMIN';
    owner = false;
    Object.values(repo).forEach((x) => x.mockClear());
  });
  const request = (path: string, method = 'GET', body?: object) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  it.each([
    '/settings/team',
    '/settings/team/invitations',
    '/settings/team/audit',
  ])('rejects User reads of admin data: %s', async (path) => {
    role = 'USER';
    expect((await request(path)).status).toBe(403);
  });
  it.each(['USER', 'ADMIN'])(
    'blocks non-owner role changes and workspace deletion for %s',
    async (value) => {
      role = value;
      expect(
        (
          await request('/settings/team/member/role', 'PUT', {
            role: 'ADMIN',
            isSuperAdmin: true,
          })
        ).status
      ).toBe(403);
      expect(
        (
          await request('/settings/workspace', 'DELETE', {
            name: 'Team A',
            role: 'SUPERADMIN',
          })
        ).status
      ).toBe(403);
      expect(repo.manageMember).not.toHaveBeenCalled();
      expect(repo.removeWorkspace).not.toHaveBeenCalled();
    }
  );
  it('blocks User invitations and workspace creation even with forged payload roles', async () => {
    role = 'USER';
    expect(
      (
        await request('/settings/team', 'POST', {
          email: 'person@example.test',
          role: 'ADMIN',
          sendEmail: false,
          isSuperAdmin: true,
        })
      ).status
    ).toBe(403);
    expect(
      (
        await request('/settings/workspaces', 'POST', {
          name: 'Forbidden',
          role: 'SUPERADMIN',
        })
      ).status
    ).toBe(403);
    expect(repo.createInvitation).not.toHaveBeenCalled();
    expect(repo.createWorkspace).not.toHaveBeenCalled();
  });
  it('lets an Admin invite Users but cannot invite Admins', async () => {
    expect(
      (
        await request('/settings/team', 'POST', {
          email: 'person@example.test',
          role: 'ADMIN',
          sendEmail: false,
        })
      ).status
    ).toBe(403);
    expect(
      (
        await request('/settings/team', 'POST', {
          email: 'person@example.test',
          role: 'USER',
          sendEmail: false,
          organizationId: 'workspace-b',
        })
      ).status
    ).toBe(201);
    expect(repo.createInvitation.mock.calls[0][0]).toEqual(
      expect.objectContaining({ organizationId: 'workspace-a', role: 'USER' })
    );
  });
  it('requires an email for copy links as well as email invitations', async () => {
    owner = true;
    expect(
      (
        await request('/settings/team', 'POST', {
          role: 'USER',
          sendEmail: false,
        })
      ).status
    ).toBe(400);
    expect(repo.createInvitation).not.toHaveBeenCalled();
  });
  it.each(['SUPERADMIN', 'OWNER', 'invalid'])(
    'rejects role escalation to %s',
    async (value) => {
      owner = true;
      expect(
        (await request('/settings/team/member/role', 'PUT', { role: value }))
          .status
      ).toBe(400);
      expect(
        (
          await request('/settings/team', 'POST', {
            email: 'person@example.test',
            role: value,
            sendEmail: false,
          })
        ).status
      ).toBe(400);
      expect(repo.manageMember).not.toHaveBeenCalled();
    }
  );
  it('scopes owner role changes and deletion to the selected workspace', async () => {
    owner = true;
    expect(
      (
        await request('/settings/team/member/role', 'PUT', {
          role: 'ADMIN',
          organizationId: 'workspace-b',
        })
      ).status
    ).toBe(200);
    expect(repo.manageMember).toHaveBeenCalledWith(
      'workspace-a',
      expect.objectContaining({ isSuperAdmin: true }),
      'member',
      'ADMIN'
    );
    expect(
      (
        await request('/settings/workspace', 'DELETE', {
          name: 'Team A',
          organizationId: 'workspace-b',
        })
      ).status
    ).toBe(200);
    expect(repo.removeWorkspace).toHaveBeenCalledWith(
      'workspace-a',
      'Team A',
      'actor'
    );
  });
  it('reserves direct addition of existing accounts for the owner', async () => {
    expect(
      (
        await request('/settings/team/add', 'POST', {
          email: 'person@example.test',
          role: 'USER',
        })
      ).status
    ).toBe(400);
  });
  it('rejects an invite if another tab changed the active workspace', async () => {
    const response = await request('/settings/team', 'POST', {
      email: 'person@example.test',
      role: 'USER',
      sendEmail: false,
      expectedWorkspaceId: 'workspace-b',
    });
    expect(response.status).toBe(409);
    expect(repo.createInvitation).not.toHaveBeenCalled();
  });
  it('accepts a matching workspace confirmation without selecting a caller-supplied workspace', async () => {
    const response = await request('/settings/team', 'POST', {
      email: 'person@example.test',
      role: 'USER',
      sendEmail: false,
      expectedWorkspaceId: 'workspace-a',
      organizationId: 'workspace-b',
    });
    expect(response.status).toBe(201);
    expect(repo.createInvitation.mock.calls[0][0].organizationId).toBe(
      'workspace-a'
    );
  });
  it('also protects direct existing-account addition after a workspace switch', async () => {
    owner = true;
    const response = await request('/settings/team/add', 'POST', {
      email: 'person@example.test',
      role: 'USER',
      expectedWorkspaceId: 'workspace-b',
    });
    expect(response.status).toBe(409);
  });
  it('validates the workspace confirmation field', async () => {
    expect(
      (
        await request('/settings/team', 'POST', {
          email: 'person@example.test',
          role: 'USER',
          sendEmail: false,
          expectedWorkspaceId: { id: 'workspace-a' },
        })
      ).status
    ).toBe(400);
    expect(repo.createInvitation).not.toHaveBeenCalled();
  });
});
