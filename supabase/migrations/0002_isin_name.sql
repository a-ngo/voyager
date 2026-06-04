-- Instrument display name on the ISIN→ticker map, populated from the price
-- source (Stooq) so the UI can show real names for any priced holding, not
-- just curated ones. Idempotent.
alter table isin_ticker_map add column if not exists name text;
