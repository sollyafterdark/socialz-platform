// Keep this fork's sessions separate from other apps on the same parent domain.
export const sessionCookieNames = {
  auth: 'socialz_auth',
  showorg: 'socialz_showorg',
  impersonate: 'socialz_impersonate',
  org: 'socialz_org',
  oauth_state: 'socialz_oauth_state',
} as const;
