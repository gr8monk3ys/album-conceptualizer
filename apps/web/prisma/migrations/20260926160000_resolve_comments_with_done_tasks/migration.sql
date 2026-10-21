-- One note, two views (src/server/comment-tasks.ts): a comment whose task is done is resolved.
-- Before this, marking a task done left its comment open; bring those notes into line once.
UPDATE "AlbumSectionComment" AS c
SET "resolvedAt" = t."doneAt", "resolvedByUserId" = NULL
FROM (
  SELECT "sourceCommentId", MAX("updatedAt") AS "doneAt"
  FROM "AlbumTask"
  WHERE "sourceCommentId" IS NOT NULL AND "deletedAt" IS NULL
  GROUP BY "sourceCommentId"
  HAVING BOOL_AND("status" = 'done')
) AS t
WHERE c."id" = t."sourceCommentId"
  AND c."deletedAt" IS NULL
  AND c."resolvedAt" IS NULL;
