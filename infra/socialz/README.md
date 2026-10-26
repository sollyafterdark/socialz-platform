# Socialz Blue Hour deployment

This fork adds the approved Socialz artwork, self-hosted Inter/Sora fonts, light
and dark colour tokens, product metadata, and a branded authentication layout.
Inter is used for Cyrillic headings. Font licence notices are in
`apps/frontend/public/brand/fonts`. Postiz's AGPL licence and history are preserved.

## Isolation

- Run only this Compose file with project `socialz`; resources have project-scoped
  names. There are no shared external databases, volumes or networks.
- Only the app is published on host loopback, port 18470. Database, Redis,
  Elasticsearch and Temporal ports stay inside this project's network.
- Use a new RAID directory `/mnt/storage/web-services/socialz-platform/uploads`.
  Do not change ownership or permissions on any existing directory. The regular
  Compose file refuses to create a missing bind source. Run the read-only
  `preflight.py` before startup; it verifies the actual ZFS pool, media path and
  free disk. A missing mount must never be replaced with a root-filesystem folder.
- Each service has CPU, memory and bounded Docker log settings. Build with a
  separate builder capped at 3 CPUs and 8 GiB; never reuse another app's builder.
- `COOKIE_HOST_ONLY=true` prevents this deployment from setting authentication
  cookies on sibling websites under the same domain.
- Use a dedicated Cloudflare Tunnel. Route `socialz.mpsolara.com` to
  `http://postiz:5000` on the ingress network. Save the token in a private file;
  never pass it in a public repository or a logged command line.

## Build and start

Copy the example env files to a private directory outside this checkout and
replace all placeholder values. Generate independent secrets. Preserve 0600
permissions. Do not reuse credentials from an existing website.

Build `Dockerfile.socialz`, label the image with the exact git revision, and pin
that image in `compose.env`. Public origin settings are already set to
`https://socialz.mpsolara.com`. Run Compose with an explicit `--env-file` and
`-f infra/socialz/compose.yaml`. Validate with `config --quiet` before starting.
Run a local health check and controlled owner bootstrap before enabling the
`public` profile. Registration is disabled after the first organisation.

The default source build installs the exact lockfile. A verified dependency-base
image may be used to speed builds only when its installed `pnpm-lock.yaml` is
byte-identical to this checkout, and all three application services are rebuilt
from this fork's source. Pin that base by digest and record it in the release.

Brand assets under `/brand/` and source downloads under `/source/` are public
static paths. Other application pages and APIs retain their authentication guards.

## Source availability

Set `SOCIALZ_SOURCE_URL` to the exact deployed public commit. If GitHub repository
write access is pending, publish a `git archive` of that commit under
`/source/socialz-source-<commit>.tar.gz` and point the visible Source code link
there. Include build/install files and all required licence notices. Build
contexts and archives must exclude runtime credentials and user media. The
generated archive is deliberately not committed recursively into itself.

## Verification and recovery

Check English and Russian, light/dark themes, keyboard focus, mobile and desktop
layout, login, owner access, calendar, media uploads, organisations and team
settings. Confirm authentication cookies have no Domain attribute. Add each
social provider's own app credentials and approvals before testing publication.
AI and Polotno require their own credentials/licensing; branding alone does not
provision external services. Configure SMTP before relying on invitations or
password reset delivery. Keep public customer signup disabled during the pilot.

Back up the app PostgreSQL database, Temporal PostgreSQL and Elasticsearch data,
Redis persistence, uploads and necessary private configuration. Verify restoration
in a separate project with publication workers stopped, and review pending posts
before resuming them. Never use global Docker prune, alter Docker daemon storage,
change RAID layout, or stop/recreate unrelated containers during this deployment.

Session routing verifies token signatures before redirecting sign-in to the app.
Invalid or expired sessions expire only this host's auth, showorg and impersonate
cookies. API 401 responses go through server logout to clear HttpOnly state.
The backend still checks the user and organisation for every protected API call.

Socialz uses socialz_auth, socialz_showorg, socialz_impersonate, socialz_org and
socialz_oauth_state cookies. Generic legacy cookies are ignored and never deleted.
HTTPS browser requests rely on HttpOnly cookies, without copying readable
cookies into authentication headers. Existing pilot users must sign in again
after this cookie isolation upgrade.
