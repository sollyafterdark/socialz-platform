import { AuthMiddleware } from './auth.middleware';
import { AuthService as Jwt } from '@gitroom/helpers/auth/auth.service';
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/sentry/initialize.sentry', () => ({
  setSentryUserContext: jest.fn(),
}));

describe('workspace membership session boundaries', () => {
  const organizations = {
    getOrgsByUserId: jest.fn(async () => []),
    getUserOrg: jest.fn(),
    updateApiKey: jest.fn(),
  };
  const users = {
    getUserById: jest.fn(async () => ({
      id: 'member',
      email: 'member@example.test',
      activated: true,
      isSuperAdmin: false,
    })),
  };
  const middleware = new AuthMiddleware(organizations as any, users as any);
  const response = { cookie: jest.fn(), header: jest.fn() } as any;
  const next = jest.fn();
  const request = (path: string, extra: object = {}) =>
    ({
      path,
      cookies: {},
      headers: {
        auth: Jwt.signJWT({ id: 'member', isSuperAdmin: true }),
        ...extra,
      },
    } as any);
  beforeEach(() => {
    process.env.JWT_SECRET = 'middleware-team-test-secret';
    process.env.FRONTEND_URL = 'https://example.test';
    jest.clearAllMocks();
    users.getUserById.mockResolvedValue({
      id: 'member',
      email: 'member@example.test',
      activated: true,
      isSuperAdmin: false,
    });
  });
  it.each(['/user/join-org', '/user/organizations', '/user/logout'])(
    'allows a verified account without a workspace to use %s',
    async (path) => {
      const req = request(path);
      await middleware.use(req, response, next);
      expect(req.user.id).toBe('member');
      expect(req.user.isSuperAdmin).toBe(false);
      expect(next).toHaveBeenCalledTimes(1);
    }
  );
  it('does not let a user without memberships enter workspace endpoints', async () => {
    await expect(
      middleware.use(request('/settings/team'), response, next)
    ).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
  it('does not trust a token claiming server administrator for impersonation', async () => {
    await expect(
      middleware.use(
        request('/settings/team', { impersonate: 'other-membership' }),
        response,
        next
      )
    ).rejects.toThrow();
    expect(organizations.getUserOrg).not.toHaveBeenCalled();
  });
  it('still requires email activation before accepting an invitation', async () => {
    users.getUserById.mockResolvedValueOnce({
      id: 'member',
      email: 'member@example.test',
      activated: false,
      isSuperAdmin: false,
    });
    await expect(
      middleware.use(request('/user/join-org'), response, next)
    ).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});
