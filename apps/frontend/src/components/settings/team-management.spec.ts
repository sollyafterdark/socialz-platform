/** @jest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { TeamsComponent, AddMember } from './teams.component';

let mockUser: any;
const mockFetch = jest.fn();
const mockMutate = jest.fn(async () => {});
const mockClose = jest.fn();
const mockToast = jest.fn();
const mockData = {
  users: [
    {
      role: 'SUPERADMIN',
      user: { id: 'owner', email: 'owner@example.test', isSuperAdmin: true },
    },
    { role: 'ADMIN', user: { id: 'admin', email: 'admin@example.test' } },
    { role: 'USER', user: { id: 'member', email: 'member@example.test' } },
  ],
};
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => mockUser,
}));
jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useModals: () => ({ closeAll: mockClose, openModal: jest.fn() }),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: mockToast }),
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: string) => ({
    data: key?.startsWith('/api/teams') ? mockData : [],
    mutate: mockMutate,
  }),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));
jest.mock('./workspace-settings.component', () => ({
  WorkspaceSettings: () => null,
}));
jest.mock('./workspace-actions.component', () => ({
  WorkspaceActions: () => React.createElement('div', null, 'Workspace actions'),
}));
jest.mock('@gitroom/react/form/button', () => ({
  Button: ({ loading, secondary, children, ...props }: any) =>
    React.createElement('button', { type: 'button', ...props }, children),
}));
jest.mock('@gitroom/react/form/input', () => ({
  Input: ({ label, name }: any) => {
    const { register } = require('react-hook-form').useFormContext();
    return React.createElement(
      'label',
      null,
      label,
      React.createElement('input', register(name))
    );
  },
}));
jest.mock('@gitroom/react/form/select', () => ({
  Select: ({ label, name, children }: any) => {
    const { register } = require('react-hook-form').useFormContext();
    return React.createElement(
      'label',
      null,
      label,
      React.createElement('select', register(name), children)
    );
  },
}));
jest.mock('@gitroom/react/form/checkbox', () => ({
  Checkbox: ({ name }: any) => {
    const { register } = require('react-hook-form').useFormContext();
    return React.createElement('input', {
      type: 'checkbox',
      ...register(name),
    });
  },
}));
jest.mock('@gitroom/react/helpers/delete.dialog', () => ({
  deleteDialog: jest.fn(async () => true),
}));
jest.mock('copy-to-clipboard', () => jest.fn(() => true));
beforeEach(() => {
  mockUser = {
    id: 'owner',
    orgId: 'workspace-a',
    isSuperAdmin: true,
    role: 'SUPERADMIN',
  };
  mockFetch.mockReset();
  mockClose.mockClear();
  mockMutate.mockClear();
  mockToast.mockClear();
});
afterEach(cleanup);
it('shows only the owner’s role controls and protects the owner row', () => {
  render(React.createElement(TeamsComponent));
  expect(screen.getByLabelText('Role for admin@example.test')).toBeTruthy();
  expect(screen.getByLabelText('Role for member@example.test')).toBeTruthy();
  expect(screen.queryByLabelText('Role for owner@example.test')).toBeNull();
});
it('lets Admins remove ordinary Users without exposing peer or owner role controls', () => {
  mockUser = {
    id: 'admin',
    orgId: 'workspace-a',
    isSuperAdmin: false,
    role: 'ADMIN',
  };
  render(React.createElement(TeamsComponent));
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
  expect(screen.queryByLabelText('Role for admin@example.test')).toBeNull();
});
it('does not expose team management data or invites to Users', () => {
  mockUser = {
    id: 'member',
    orgId: 'workspace-a',
    isSuperAdmin: false,
    role: 'USER',
  };
  render(React.createElement(TeamsComponent));
  expect(screen.queryByRole('button', { name: 'Add member' })).toBeNull();
  expect(screen.queryByText('owner@example.test (you)')).toBeNull();
});
it('offers only User invitations to an Admin', () => {
  mockUser.isSuperAdmin = false;
  mockUser.role = 'ADMIN';
  render(React.createElement(AddMember));
  expect(screen.queryByRole('option', { name: 'Admin' })).toBeNull();
  expect(screen.queryByLabelText('Add method')).toBeNull();
});
it('keeps a failed native invitation open and shows the backend error', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ message: 'Not allowed' }),
  });
  render(React.createElement(AddMember));
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await screen.findByText('Not allowed');
  expect(mockClose).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});
it('uses the existing owner-only add endpoint for an existing account', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ added: true }),
  });
  render(React.createElement(AddMember));
  fireEvent.change(screen.getByLabelText('Add method'), {
    target: { value: 'existing' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
  await waitFor(() => expect(mockClose).toHaveBeenCalled());
  expect(mockFetch).toHaveBeenCalledWith(
    '/settings/team/add',
    expect.objectContaining({ method: 'POST' })
  );
});
