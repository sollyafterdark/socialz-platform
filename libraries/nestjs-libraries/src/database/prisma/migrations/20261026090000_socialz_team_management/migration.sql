CREATE TABLE "TeamInvitation" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "email" TEXT NOT NULL,
 "role" "Role" NOT NULL, "invitedBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3),
 "acceptedBy" TEXT, "revokedAt" TIMESTAMP(3),
 CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TeamInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TeamInvitation_organizationId_createdAt_idx" ON "TeamInvitation"("organizationId", "createdAt");
CREATE TABLE "TeamAudit" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "action" TEXT NOT NULL, "target" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TeamAudit_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TeamAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TeamAudit_organizationId_createdAt_idx" ON "TeamAudit"("organizationId", "createdAt");
