-- Address list contacts: named directory entries + watchlist type

ALTER TABLE "address_list_entries" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE "address_list_entries" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "address_list_entries" ADD COLUMN IF NOT EXISTS "tags" json;
