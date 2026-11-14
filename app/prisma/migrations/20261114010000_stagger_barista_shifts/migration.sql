BEGIN;
ALTER TYPE "ShiftStation" ADD VALUE IF NOT EXISTS 'BARISTA_2';
COMMIT;

-- Keep signups at their original start times when the two baristas alternate.
UPDATE "ShiftSignup"
SET "station" = 'BARISTA_2'
WHERE "station" = 'BARISTA' AND "startMinute" IN (680, 760);
