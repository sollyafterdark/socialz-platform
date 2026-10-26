# Socialz workspace management

Socialz reuses Postiz organizations, UserOrganization memberships, signed invitation links, email sender, and organization switch endpoint. The only server owner is the existing active account with User.isSuperAdmin=true. No team endpoint can set that flag or assign the SUPERADMIN role.

| Account / workspace role | Workspace controls |
| --- | --- |
| User | Publish using native Postiz; leave after joining another workspace |
| Admin | Rename; create a workspace; invite Users; remove Users |
| Socialz owner | All Admin controls; invite/add Admins; change USER/ADMIN roles; remove Admins; delete a workspace; native server support |

New workspaces always include the existing Socialz owner as SUPERADMIN. An Admin creator receives ADMIN. Public registration remains closed. A current, email-bound invitation permits account creation and uses native email activation for local accounts. Invited signup joins that workspace without creating another personal workspace or owner. Adding an existing account directly is available only to the server owner through Postiz's existing exact-email add function.

Invitations expire after two days and have persistent single-use, accepted, revoked, and expired state. A link requires the invited email even when copied manually. Acceptance checks the sender still has permission. Existing membership roles are never changed by accepting an invite. Pending invites can be copied, resent before expiry, or revoked; expired invites require a new invitation. Old invitation links issued before this upgrade must be replaced.

Workspace deletion uses Postiz's soft-delete convention. Only the server owner can delete, with an exact name confirmation. The owner's final workspace is protected, and every member must have another active workspace. Scheduled/repeating posts must first be cancelled using native Postiz, and active auto-posting must be disabled. Deletion disconnects channels, disables auto-posts, revokes pending invitations, and removes workspace access. Published social network posts stay online. Records and media are retained; there is no self-service restore or permanent purge feature.

A removed member's account and other memberships remain intact. Authenticated accounts without a workspace can still accept a new invitation or sign out. Team lists and invitation/audit data are restricted to Admins and the owner. Self-hosted mode bypasses billing limits while retaining ADMIN role restrictions.

## Deployment

Generate the Prisma client and build all three applications. Before starting the new application, back up the database and apply the additive SQL in:

libraries/nestjs-libraries/src/database/prisma/migrations/20261026090000_socialz_team_management/migration.sql

The upgrade adds TeamInvitation and TeamAudit; it does not alter existing user, workspace, channel, or post rows. This repository otherwise uses Prisma db push, so this SQL is applied explicitly by the Socialz deployment procedure. An older application image can run with the two extra tables left in place. Do not drop invitation or audit records during an application rollback.

## Validation

Tests cover self-hosted HTTP authorization, role escalation, tenant scope, sole ownership, member removal, invitation expiry/revocation/email binding/concurrent acceptance, invited registration/activation, session membership boundaries, deletion safeguards, and the existing workspace selector/rename/logout behavior. Integration tests require SOCIALZ_TEAM_TEST_DB=true and a database named exactly socialz_team_test. They truncate that disposable test database and refuse to run against another database.
