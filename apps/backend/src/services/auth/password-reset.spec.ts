import { AuthService } from './auth.service';
import { AuthService as Tokens } from '@gitroom/helpers/auth/auth.service';
import { sign } from 'jsonwebtoken';

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
  NewsletterService: class {},
}));

const secret = 'reset-regression-test-key-not-a-runtime-secret';
const priorSecret = process.env.JWT_SECRET;
let updatePassword: jest.Mock;
let service: AuthService;

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  updatePassword = jest.fn().mockResolvedValue({ id: 'regular-member' });
  service = new AuthService(
    { updatePassword } as any,
    {} as any,
    {} as any,
    {} as any
  );
});
afterAll(() => {
  if (priorSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = priorSecret;
});

it('resets a regular member password without requiring an owner session', async () => {
  const token = Tokens.signJWT({
    id: 'regular-member',
    expires: new Date(Date.now() + 60000).toISOString(),
  });
  expect(
    await service.forgotReturn({
      token,
      password: 'new-test-password',
      repeatPassword: 'new-test-password',
    })
  ).toBe(true);
  expect(updatePassword).toHaveBeenCalledWith(
    'regular-member',
    'new-test-password'
  );
});

it.each([
  ['malformed', () => 'not-a-jwt'],
  [
    'foreign',
    () =>
      sign(
        {
          id: 'regular-member',
          expires: new Date(Date.now() + 60000).toISOString(),
        },
        'other-key'
      ),
  ],
  [
    'expired',
    () =>
      Tokens.signJWT({
        id: 'regular-member',
        expires: new Date(Date.now() - 60000).toISOString(),
      }),
  ],
  ['missing expiry', () => Tokens.signJWT({ id: 'regular-member' })],
  [
    'invalid expiry',
    () => Tokens.signJWT({ id: 'regular-member', expires: 'not-a-date' }),
  ],
  [
    'missing id',
    () =>
      Tokens.signJWT({ expires: new Date(Date.now() + 60000).toISOString() }),
  ],
])(
  'rejects %s links without changing a password or throwing',
  async (_, makeToken) => {
    expect(
      await service.forgotReturn({
        token: makeToken(),
        password: 'test-password',
        repeatPassword: 'test-password',
      })
    ).toBe(false);
    expect(updatePassword).not.toHaveBeenCalled();
  }
);

it('reports failure if the account no longer exists', async () => {
  updatePassword.mockRejectedValue(new Error('Account removed'));
  const token = Tokens.signJWT({
    id: 'removed-user',
    expires: new Date(Date.now() + 60000).toISOString(),
  });
  expect(
    await service.forgotReturn({
      token,
      password: 'test-password',
      repeatPassword: 'test-password',
    })
  ).toBe(false);
});
