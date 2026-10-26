import { AuthService } from './auth.service';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { AuthService as Jwt } from '@gitroom/helpers/auth/auth.service';
import { Provider } from '@prisma/client';
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/users/users.service',
  () => ({ UsersService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class {},
}));
jest.mock('@gitroom/backend/services/auth/providers/providers.manager', () => ({
  AuthProviderManager: class {},
}));
jest.mock('@gitroom/nestjs-libraries/newsletter/newsletter.service', () => ({
  NewsletterService: { register: jest.fn(async () => {}) },
}));

describe('invite-only registration using native auth', () => {
  const invitation = {
    id: 'secure-invite-id',
    orgId: 'workspace-a',
    role: 'USER' as const,
    email: 'new@example.test',
  };
  const users = {
    getUserByEmail: jest.fn(async () => null),
    getUserByProvider: jest.fn(async () => null),
  };
  const organizations = {
    getCount: jest.fn(async () => 1),
    validInvitation: jest.fn(async (_details, email) => {
      if (email && email !== invitation.email) throw new Error('wrong email');
      return invitation;
    }),
    createInvitedUser: jest.fn(async () => ({
      user: {
        id: 'new-user',
        email: invitation.email,
        isSuperAdmin: false,
        activated: false,
      },
      membership: { organizationId: invitation.orgId, role: 'USER' },
    })),
    createOrgAndUser: jest.fn(),
    acceptInvitation: jest.fn(async () => ({
      organizationId: invitation.orgId,
    })),
  };
  const email = { sendEmailSync: jest.fn(async () => {}) };
  const provider = {
    getUser: jest.fn(async () => ({
      id: 'verified-provider-id',
      email: invitation.email,
    })),
  };
  const auth = new AuthService(
    users as any,
    organizations as any,
    email as any,
    { getProvider: () => provider } as any
  );
  const body = () =>
    Object.assign(new CreateOrgUserDto(), {
      email: invitation.email,
      password: 'example-test-password',
      provider: Provider.LOCAL,
      company: 'Invited team member',
    });
  beforeEach(() => {
    process.env.DISABLE_REGISTRATION = 'true';
    process.env.JWT_SECRET = 'auth-team-test-secret';
    process.env.FRONTEND_URL = 'https://example.test';
    jest.clearAllMocks();
    users.getUserByEmail.mockResolvedValue(null);
    users.getUserByProvider.mockResolvedValue(null);
  });
  it('keeps public signup closed for LOCAL and GENERIC providers', async () => {
    await expect(
      auth.routeAuth(Provider.LOCAL, body(), '127.0.0.1', 'test')
    ).rejects.toThrow('disabled');
    await expect(auth.canRegister(Provider.GENERIC)).resolves.toBe(false);
    expect(organizations.createOrgAndUser).not.toHaveBeenCalled();
  });
  it('registers a matching invited email without creating another owner or personal workspace', async () => {
    const result = await auth.routeAuth(
      Provider.LOCAL,
      body(),
      '127.0.0.1',
      'test',
      invitation
    );
    expect(organizations.createInvitedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: invitation.email }),
      '127.0.0.1',
      'test',
      invitation
    );
    expect(organizations.createOrgAndUser).not.toHaveBeenCalled();
    expect(result.addedOrg).toEqual({
      organizationId: 'workspace-a',
      role: 'USER',
    });
    expect(email.sendEmailSync).toHaveBeenCalledTimes(1);
    const decoded = Jwt.verifyJWT(result.jwt) as any;
    expect(decoded.isSuperAdmin).toBe(false);
    expect(decoded.activated).toBe(false);
  });
  it('rejects the wrong invited email before account creation', async () => {
    const values = body();
    values.email = 'different@example.test';
    await expect(
      auth.routeAuth(Provider.LOCAL, values, '127.0.0.1', 'test', invitation)
    ).rejects.toThrow();
    expect(organizations.createInvitedUser).not.toHaveBeenCalled();
  });
  it('rejects revoked invitations before opening signup', async () => {
    organizations.validInvitation.mockRejectedValueOnce(new Error('revoked'));
    expect(await auth.canRegister(Provider.LOCAL, invitation)).toBe(false);
  });
  it('uses the provider-verified email to authorize OAuth invited signup', async () => {
    provider.getUser.mockResolvedValueOnce({
      id: 'verified-provider-id',
      email: 'other@example.test',
    });
    await expect(
      auth.routeAuth(
        Provider.GOOGLE,
        { providerToken: 'test' } as any,
        '127.0.0.1',
        'test',
        invitation
      )
    ).rejects.toThrow('disabled');
    expect(organizations.createInvitedUser).not.toHaveBeenCalled();
  });
  it('validates purpose, signature, role, and expiry before using invitation claims', () => {
    const token = (extra: object) =>
      Jwt.signJWT({
        ...invitation,
        purpose: 'team-invitation',
        timeLimit: new Date(Date.now() + 60000).toISOString(),
        ...extra,
      });
    expect(auth.getOrgFromCookie(token({}))).toEqual(
      expect.objectContaining(invitation)
    );
    for (const extra of [
      { purpose: 'session' },
      { role: 'SUPERADMIN' },
      { timeLimit: 'invalid' },
      { timeLimit: new Date(0).toISOString() },
      { email: null },
    ])
      expect(auth.getOrgFromCookie(token(extra))).toBe(false);
    expect(auth.getOrgFromCookie('forged')).toBe(false);
  });
});
