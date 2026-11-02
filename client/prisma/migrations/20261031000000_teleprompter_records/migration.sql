-- CreateTable
CREATE TABLE "ScriptFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT NOT NULL,
    "scriptFolderId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "sourceProvider" TEXT,
    "sourcePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "Script_scriptFolderId_fkey" FOREIGN KEY ("scriptFolderId") REFERENCES "ScriptFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrompterPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

-- CreateIndex
CREATE INDEX "ScriptFolder_createdById_idx" ON "ScriptFolder"("createdById");

-- CreateIndex
CREATE INDEX "Script_createdById_idx" ON "Script"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PrompterPreference_createdById_key" ON "PrompterPreference"("createdById");

