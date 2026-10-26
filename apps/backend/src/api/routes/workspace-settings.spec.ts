import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({ OrganizationService: class {} })
);

describe('workspace settings HTTP authorization and validation', () => {
  let app: INestApplication;
  let base: string;
  let role: string | undefined;
  let serverAdmin = false;
  const rename = jest.fn(async (id, name) => ({ id, name }));

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: OrganizationService,
          useValue: {
            updateWorkspaceName: rename,
            getWorkspaceSettings: async (id: string) => ({
              id,
              name: 'Original workspace',
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _: any, next: () => void) => {
      req.user = { id: 'member-a', isSuperAdmin: serverAdmin };
      req.org = { id: 'workspace-a', users: role ? [{ role }] : [] };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    role = 'ADMIN';
    serverAdmin = false;
    rename.mockClear();
  });
  const update = (body: object) =>
    fetch(base + '/settings/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it.each(['ADMIN', 'SUPERADMIN'])(
    'allows %s to rename only their current workspace',
    async (value) => {
      role = value;
      const response = await update({
        name: '  Solara & Мария  ',
        organizationId: 'workspace-b',
        id: 'workspace-b',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: 'workspace-a',
        name: 'Solara & Мария',
      });
      expect(rename).toHaveBeenCalledWith('workspace-a', 'Solara & Мария');
    }
  );
  it('allows a server administrator to rename the currently selected workspace', async () => {
    role = 'USER';
    serverAdmin = true;
    expect((await update({ name: 'Renamed' })).status).toBe(200);
    expect(rename).toHaveBeenCalledWith('workspace-a', 'Renamed');
  });
  it.each(['USER', undefined])(
    'rejects a non-admin role %s even if the payload claims administrator access',
    async (value) => {
      role = value;
      const response = await update({
        name: 'Forbidden rename',
        isSuperAdmin: true,
        role: 'SUPERADMIN',
      });
      expect(response.status).toBe(403);
      expect(rename).not.toHaveBeenCalled();
    }
  );
  it.each(['', '   ', null, 'x'.repeat(101), '<b>name</b>', 'line\nbreak'])(
    'rejects invalid names without writing: %s',
    async (name) => {
      expect((await update({ name })).status).toBe(400);
      expect(rename).not.toHaveBeenCalled();
    }
  );
  it('requires a name', async () => {
    expect((await update({})).status).toBe(400);
    expect(rename).not.toHaveBeenCalled();
  });
  it('reads the current workspace without exposing other organization settings', async () => {
    const response = await fetch(
      base + '/settings/workspace?organizationId=workspace-b'
    );
    expect(await response.json()).toEqual({
      id: 'workspace-a',
      name: 'Original workspace',
    });
  });
});
