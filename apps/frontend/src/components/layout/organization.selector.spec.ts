/** @jest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { OrganizationSelector } from './organization.selector';

const mockFetch = jest.fn().mockResolvedValue({ ok: true });
const mockReload = jest.fn();
let mockData: any[];
let mockUser: any;
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => mockUser,
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: mockData, isLoading: false }),
}));
const originalLocation = window.location;
beforeAll(() => {
  delete (window as any).location;
  (window as any).location = { reload: mockReload };
});
afterAll(() => {
  (window as any).location = originalLocation;
});
beforeEach(() => {
  mockUser = { orgId: 'workspace-a' };
  mockData = [
    { id: 'workspace-a', name: 'Socialz', users: [{ role: 'SUPERADMIN' }] },
  ];
  mockFetch.mockClear();
  mockReload.mockClear();
});
afterEach(cleanup);
const component = (props = {}) =>
  React.createElement(OrganizationSelector, props);
const addTeam = () =>
  mockData.push({
    id: 'workspace-b',
    name: 'Second team',
    users: [{ role: 'USER' }],
  });

it('shows the current name for a single workspace without a switch button', () => {
  render(component());
  expect(screen.getByLabelText('Current workspace: Socialz')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
it('lists memberships returned by Postiz and marks the current workspace', () => {
  addTeam();
  render(component());
  fireEvent.click(
    screen.getByRole('button', { name: 'Current workspace: Socialz' })
  );
  const options = screen.getAllByRole('menuitemradio');
  expect(options).toHaveLength(2);
  expect(options[0].getAttribute('aria-checked')).toBe('true');
  expect(options[1].getAttribute('aria-checked')).toBe('false');
});
it('uses the native Postiz change-org endpoint and reloads when another team is selected', async () => {
  addTeam();
  render(component());
  fireEvent.click(
    screen.getByRole('button', { name: 'Current workspace: Socialz' })
  );
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Second team' }));
  await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1));
  expect(mockFetch).toHaveBeenCalledWith('/user/change-org', {
    method: 'POST',
    body: JSON.stringify({ id: 'workspace-b' }),
  });
});
it('closes on Escape without switching teams', () => {
  addTeam();
  render(component());
  const trigger = screen.getByRole('button', {
    name: 'Current workspace: Socialz',
  });
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});
it('updates the visible current team when the current membership changes', () => {
  addTeam();
  const view = render(component());
  mockUser = { orgId: 'workspace-b' };
  view.rerender(component());
  expect(
    screen.getByRole('button', { name: 'Current workspace: Second team' })
  ).toBeTruthy();
});
it('retains the built-in open selector for billing without listing the current workspace', () => {
  addTeam();
  render(component({ asOpenSelect: true }));
  expect(screen.getByText('Select Organization')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Second team/ })).toBeTruthy();
  expect(screen.queryByText('Socialz')).toBeNull();
});
