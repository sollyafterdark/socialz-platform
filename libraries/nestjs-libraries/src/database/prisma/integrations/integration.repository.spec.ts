import { IntegrationRepository } from './integration.repository';

jest.mock('@gitroom/nestjs-libraries/database/prisma/prisma.service', () => ({
  PrismaRepository: class {},
}));
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: { createStorage: () => ({ uploadSimple: jest.fn() }) },
}));

const channelId = 'existing-instagram-channel';
const loginId = 'fresh-facebook-login';
const orgId = 'workspace';
let model: { findUnique: jest.Mock; update: jest.Mock };
let posts: { updateMany: jest.Mock };
let repository: IntegrationRepository;

beforeEach(() => {
  model = {
    findUnique: jest.fn(),
    update: jest.fn().mockImplementation(async (args) => ({
      id: args.where.id,
      ...args.data,
    })),
  };
  posts = { updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
  repository = new IntegrationRepository(
    { model: { integration: model } } as any,
    { model: { post: posts } } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
});

it.each(['instagram-standalone', 'instagram'])(
  'uses fresh Facebook credentials with the Facebook provider when reusing a %s channel',
  async (previousProvider) => {
    model.findUnique
      .mockResolvedValueOnce({ id: channelId, providerIdentifier: previousProvider })
      .mockResolvedValueOnce({
        providerIdentifier: 'instagram',
        rootInternalId: 'facebook-user',
        refreshToken: 'fresh-test-refresh-token',
        tokenExpiration: new Date('2030-01-01T00:00:00Z'),
      });

    const result = await repository.updateIntegration(loginId, {
      organizationId: orgId,
      internalId: 'instagram-account',
      profile: 'solara_test',
      token: 'fresh-test-page-token',
      inBetweenSteps: false,
    });

    expect(result).toMatchObject({
      id: channelId,
      providerIdentifier: 'instagram',
      rootInternalId: 'facebook-user',
      token: 'fresh-test-page-token',
      refreshToken: 'fresh-test-refresh-token',
      disabled: false,
      refreshNeeded: false,
    });
    expect(model.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: channelId } })
    );
    // Only the temporary login is retired; the existing channel and its posts survive.
    expect(posts.updateMany).toHaveBeenCalledTimes(1);
    expect(posts.updateMany).toHaveBeenCalledWith({
      where: { integrationId: loginId },
      data: { deletedAt: expect.any(Date) },
    });
  }
);

it('keeps the existing provider when completing a new account with no collision', async () => {
  model.findUnique.mockResolvedValueOnce(null);

  const result = await repository.updateIntegration(loginId, {
    organizationId: orgId,
    internalId: 'new-instagram-account',
    token: 'fresh-test-page-token',
    inBetweenSteps: false,
  });

  expect(result.id).toBe(loginId);
  expect(model.findUnique).toHaveBeenCalledTimes(1);
  expect(posts.updateMany).not.toHaveBeenCalled();
  expect(model.update).toHaveBeenCalledTimes(1);
  expect(model.update.mock.calls[0][0].data).not.toHaveProperty('providerIdentifier');
});

it('retains a standalone provider when the fresh login is standalone', async () => {
  model.findUnique
    .mockResolvedValueOnce({ id: channelId, providerIdentifier: 'instagram' })
    .mockResolvedValueOnce({
      providerIdentifier: 'instagram-standalone',
      rootInternalId: 'instagram-account',
      refreshToken: 'fresh-test-standalone-token',
      tokenExpiration: new Date('2030-01-01T00:00:00Z'),
    });

  const result = await repository.updateIntegration(loginId, {
    organizationId: orgId,
    internalId: 'instagram-account',
    token: 'fresh-test-standalone-token',
  });

  expect(result.providerIdentifier).toBe('instagram-standalone');
  expect(result.id).toBe(channelId);
});
