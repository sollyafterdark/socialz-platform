/** @jest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { WorkspaceSettings } from './workspace-settings.component';

const mockFetch = jest.fn();
const mockUpdate = jest.fn();
const mockMutate = jest.fn().mockResolvedValue(undefined);
const mockToast = jest.fn();
let mockUser: any;
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => mockUser,
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_: string, text: string) => text,
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: mockToast }),
}));
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({
    data: { id: 'workspace-a', name: 'Socialz' },
    mutate: mockUpdate,
  }),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));
jest.mock('@gitroom/react/form/input', () => ({
  Input: ({ disableForm, removeError, label, ...props }: any) =>
    require('react').createElement('input', props),
}));
jest.mock('@gitroom/react/form/button', () => ({
  Button: ({ loading, children, ...props }: any) =>
    require('react').createElement('button', props, children),
}));
beforeEach(() => {
  mockUser = { role: 'ADMIN', orgId: 'workspace-a', isSuperAdmin: false };
  mockFetch.mockReset();
  mockUpdate.mockReset();
  mockMutate.mockClear();
  mockToast.mockClear();
});
afterEach(cleanup);

it('hides renaming controls from regular members', () => {
  mockUser.role = 'USER';
  render(React.createElement(WorkspaceSettings));
  expect(
    screen.queryByRole('button', { name: 'Save workspace name' })
  ).toBeNull();
});
it('saves the name and refreshes the workspace switcher', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'workspace-a', name: 'Solara team' }),
  });
  render(React.createElement(WorkspaceSettings));
  fireEvent.change(screen.getByLabelText('Workspace name'), {
    target: { value: ' Solara team ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save workspace name' }));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      { id: 'workspace-a', name: 'Solara team' },
      { revalidate: false }
    )
  );
  expect(mockFetch).toHaveBeenCalledWith('/settings/workspace', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Solara team' }),
  });
  expect(mockMutate).toHaveBeenCalledWith('organizations');
});
it('keeps an unsuccessful edit available for retry and does not report success', async () => {
  mockFetch.mockRejectedValue(new Error('Connection interrupted'));
  render(React.createElement(WorkspaceSettings));
  fireEvent.change(screen.getByLabelText('Workspace name'), {
    target: { value: 'Solara team' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save workspace name' }));
  await screen.findByRole('alert');
  expect(
    (screen.getByLabelText('Workspace name') as HTMLInputElement).value
  ).toBe('Solara team');
  expect(mockToast).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
