-- Snapshot the customer-visible price range when an order is placed.
-- Existing orders only recorded the configured price, so their historical
-- minimum and maximum are backfilled to that same exact value.

ALTER TABLE "Order"
ADD COLUMN "totalMin" INTEGER,
ADD COLUMN "totalMax" INTEGER;

UPDATE "Order"
SET
  "totalMin" = "total",
  "totalMax" = "total";

ALTER TABLE "Order"
ALTER COLUMN "totalMin" SET NOT NULL,
ALTER COLUMN "totalMax" SET NOT NULL;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_total_range_check"
CHECK (
  "totalMin" >= 0
  AND "totalMax" >= "totalMin"
);

ALTER TABLE "OrderItem"
ADD COLUMN "unitPriceMin" INTEGER,
ADD COLUMN "unitPriceMax" INTEGER,
ADD COLUMN "usesSuggestedPriceRange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priceRangeCaptured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "OrderItem"
SET
  "unitPriceMin" = "unitPrice",
  "unitPriceMax" = "unitPrice";

ALTER TABLE "OrderItem"
ALTER COLUMN "unitPriceMin" SET NOT NULL,
ALTER COLUMN "unitPriceMax" SET NOT NULL;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_unit_price_range_check"
CHECK (
  "unitPriceMin" >= 0
  AND "unitPriceMax" >= "unitPriceMin"
);
