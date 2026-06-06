-- Instrument display name as provided by the broker export (Trade Republic now
-- includes it), so the UI can show real names straight from import.
alter table transactions add column if not exists name text;
