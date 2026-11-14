CREATE TYPE "ShiftStation" AS ENUM ('FRONT_OF_HOUSE', 'BARISTA');

CREATE TABLE "ShiftSignup" (
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "station" "ShiftStation" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    PRIMARY KEY ("organizationId", "station", "startMinute")
);
