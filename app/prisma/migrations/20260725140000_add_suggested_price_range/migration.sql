ALTER TABLE "MenuItem"
ADD COLUMN "suggestedMinPrice" INTEGER,
ADD COLUMN "suggestedMaxPrice" INTEGER,
ADD COLUMN "useSuggestedPriceRange" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MenuItem"
ADD CONSTRAINT "MenuItem_suggestedPriceRange_check"
CHECK (
  ("suggestedMinPrice" IS NULL OR "suggestedMinPrice" >= 0)
  AND ("suggestedMaxPrice" IS NULL OR "suggestedMaxPrice" >= 0)
  AND (
    NOT "useSuggestedPriceRange"
    OR (
      "suggestedMinPrice" IS NOT NULL
      AND "suggestedMaxPrice" IS NOT NULL
      AND "suggestedMaxPrice" >= "suggestedMinPrice"
    )
  )
);
