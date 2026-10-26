import { PermissionsService } from './permissions.service';
import { AuthorizationActions, Sections } from './permission.exception.class';
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({ SubscriptionService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/posts.service',
  () => ({ PostsService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({ IntegrationService: class {} })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service',
  () => ({ WebhooksService: class {} })
);

describe('self-hosted plan and role separation', () => {
  const service = new PermissionsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  beforeEach(() => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  });
  it.each(['USER', 'ADMIN', 'SUPERADMIN'] as const)(
    'enforces ADMIN role for %s without Stripe',
    async (role) => {
      const ability = await service.check('org', new Date(), role, [
        [AuthorizationActions.Create, Sections.ADMIN],
        [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
      ]);
      expect(ability.can(AuthorizationActions.Create, Sections.ADMIN)).toBe(
        role !== 'USER'
      );
      expect(
        ability.can(AuthorizationActions.Create, Sections.TEAM_MEMBERS)
      ).toBe(true);
    }
  );
});
