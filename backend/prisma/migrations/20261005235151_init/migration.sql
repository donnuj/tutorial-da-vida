-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "gameAge" INTEGER NOT NULL DEFAULT 0,
    "gameTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phase" TEXT NOT NULL DEFAULT 'childhood',
    "intelligence" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "education" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discipline" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "health" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "energy" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "happiness" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "stress" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "sociability" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "communication" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creativity" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "resilience" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "financialKnowledge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "money" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyIncome" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyExpenses" DECIMAL(12,2) NOT NULL DEFAULT 500,
    "locationId" TEXT NOT NULL DEFAULT 'home',
    "currentActivity" TEXT,
    "activityEndsAt" TIMESTAMP(3),
    "activityData" TEXT,
    "jobId" TEXT,
    "jobTitle" TEXT,
    "jobExperience" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "studyProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "studyTarget" TEXT,
    "politicalLeaning" TEXT,
    "propertyIds" TEXT,
    "inheritedMoney" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "inheritedReputation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parentCharacterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSave" (
    "id" SERIAL NOT NULL,
    "characterId" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "lastOnline" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSaveAudit" (
    "id" SERIAL NOT NULL,
    "characterId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSaveAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE INDEX "Character_accountId_idx" ON "Character"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSave_characterId_key" ON "CharacterSave"("characterId");

-- CreateIndex
CREATE INDEX "CharacterSaveAudit_characterId_idx" ON "CharacterSaveAudit"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSaveAudit_characterId_revision_key" ON "CharacterSaveAudit"("characterId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_accountId_idx" ON "RefreshToken"("accountId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_accountId_idx" ON "PasswordResetToken"("accountId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSave" ADD CONSTRAINT "CharacterSave_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSaveAudit" ADD CONSTRAINT "CharacterSaveAudit_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
