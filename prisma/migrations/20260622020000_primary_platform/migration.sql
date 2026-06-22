-- Primary platform preference: the chess account a user treats as "home", used to default
-- the game picker and analysis surfaces. Nullable — when unset the app infers it from the
-- user's most recent imported game, so existing rows need no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "primaryPlatform" TEXT;
