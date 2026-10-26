/** @jest-environment jsdom */
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { Forgot } from './forgot';
import { ForgotReturn } from './forgot-return';
import AuthenticationComponent from '../settings/authentication.component';

const mockFetch = jest.fn();
let mockUser: any = {
  email: 'member@example.test',
  providerName: 'LOCAL',
  role: 'USER',
};
jest.mock('@gitroom/helpers/utils/custom.fetch', () => ({
  useFetch: () => mockFetch,
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_: string, fallback: string) => fallback,
}));
jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => mockUser,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: any) =>
    require('react').createElement('a', { href }, children),
}));
jest.mock('@gitroom/react/form/input', () => ({
  Input: ({ label, translationKey, ...props }: any) =>
    require('react').createElement('input', {
      ...props,
      'aria-label': props['aria-label'] || label,
    }),
}));
jest.mock('@gitroom/react/form/button', () => ({
  Button: ({ loading, children, ...props }: any) =>
    require('react').createElement(
      'button',
      { ...props, disabled: !!loading },
      children
    ),
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockUser = {
    email: 'member@example.test',
    providerName: 'LOCAL',
    role: 'USER',
  };
});
afterEach(cleanup);
const result = (data: object, ok = true) => ({ ok, json: async () => data });
const submitPassword = () => {
  fireEvent.change(screen.getByLabelText('New Password'), {
    target: { value: 'a-test-password' },
  });
  fireEvent.change(screen.getByLabelText('Repeat Password'), {
    target: { value: 'a-test-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
};

it.each(['USER', 'ADMIN', 'SUPERADMIN'])(
  'offers a reset link to a local %s in Settings',
  (role) => {
    mockUser.role = role;
    render(React.createElement(AuthenticationComponent));
    expect(
      screen.getByRole('link', { name: 'Reset password' }).getAttribute('href')
    ).toBe('/auth/forgot');
  }
);
it('does not offer a local password reset for an external sign-in provider', () => {
  mockUser.providerName = 'GOOGLE';
  render(React.createElement(AuthenticationComponent));
  expect(screen.queryByRole('link', { name: 'Reset password' })).toBeNull();
});
it('keeps the reset request form usable after email delivery fails', async () => {
  mockFetch.mockResolvedValueOnce(result({ forgot: false }));
  render(React.createElement(Forgot));
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.test' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Send Password Reset Email' })
  );
  await screen.findByRole('alert');
  expect(screen.queryByRole('status')).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Send Password Reset Email',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
  mockFetch.mockResolvedValueOnce(result({ forgot: true }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Send Password Reset Email' })
  );
  await screen.findByRole('status');
});
it('shows an expired-link error and a recovery link without claiming success', async () => {
  mockFetch.mockResolvedValue(result({ reset: false }));
  render(React.createElement(ForgotReturn, { token: 'expired-test-token' }));
  submitPassword();
  await screen.findByRole('alert');
  expect(screen.queryByRole('status')).toBeNull();
  expect(
    screen
      .getByRole('link', { name: 'Request a new reset link' })
      .getAttribute('href')
  ).toBe('/auth/forgot');
  expect(
    (
      screen.getByRole('button', {
        name: 'Change Password',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false);
});
it('recovers from a network failure without hiding the form', async () => {
  mockFetch.mockRejectedValue(new Error('Connection interrupted'));
  render(React.createElement(ForgotReturn, { token: 'network-test-token' }));
  submitPassword();
  await screen.findByRole('alert');
  expect(screen.getByLabelText('New Password')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
it('shows success only after the API accepts the new password', async () => {
  mockFetch.mockResolvedValue(result({ reset: true }));
  render(React.createElement(ForgotReturn, { token: 'valid-test-token' }));
  submitPassword();
  await screen.findByRole('status');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(
    screen.getByRole('link', { name: 'Go back to login' }).getAttribute('href')
  ).toBe('/auth/logout');
});
it('does not submit mismatched passwords', async () => {
  render(React.createElement(ForgotReturn, { token: 'valid-test-token' }));
  fireEvent.change(screen.getByLabelText('New Password'), {
    target: { value: 'test-password' },
  });
  fireEvent.change(screen.getByLabelText('Repeat Password'), {
    target: { value: 'different-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Change Password',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  expect(mockFetch).not.toHaveBeenCalled();
});
