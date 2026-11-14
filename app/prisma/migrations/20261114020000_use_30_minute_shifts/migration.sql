BEGIN;

-- Keep each front-of-house signup near its old start. Prefer a newer booking
-- if the half-hour slot was filled before deployment.
UPDATE "ShiftSignup" AS signup
SET "startMinute" = times.new_start
FROM (VALUES (640, 630), (680, 690), (760, 750), (800, 810)) AS times(old_start, new_start)
WHERE signup."station" = 'FRONT_OF_HOUSE'
  AND signup."startMinute" = times.old_start
  AND NOT EXISTS (
    SELECT 1 FROM "ShiftSignup" AS existing
    WHERE existing."organizationId" = signup."organizationId"
      AND existing."station" = signup."station"
      AND existing."startMinute" = times.new_start
  );

-- The opening main (C) and backup (B) already have the right keys. If the
-- previous shifts identify one other barista, carry their name into A.
WITH remaining AS (
  SELECT signup."organizationId", min(signup.name) AS name
  FROM "ShiftSignup" AS signup
  WHERE signup.station IN ('BARISTA', 'BARISTA_2')
    AND NOT EXISTS (
      SELECT 1 FROM "ShiftSignup" AS opener
      WHERE opener."organizationId" = signup."organizationId"
        AND opener.station IN ('BARISTA', 'BARISTA_2')
        AND opener."startMinute" = 600
        AND lower(trim(opener.name)) = lower(trim(signup.name))
    )
  GROUP BY signup."organizationId"
  HAVING count(DISTINCT lower(trim(signup.name))) = 1
)
INSERT INTO "ShiftSignup" ("organizationId", station, "startMinute", name)
SELECT "organizationId", 'BARISTA_2', 620, name FROM remaining
ON CONFLICT DO NOTHING;

COMMIT;
