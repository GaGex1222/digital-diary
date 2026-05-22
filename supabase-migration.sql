-- Run this in your Supabase SQL Editor

-- Add entry_date column (one entry per calendar day)
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS entry_date date;

-- Backfill from created_at for any existing rows
UPDATE diary_entries SET entry_date = created_at::date WHERE entry_date IS NULL;

-- Make it required and unique
ALTER TABLE diary_entries ALTER COLUMN entry_date SET NOT NULL;
ALTER TABLE diary_entries ADD CONSTRAINT diary_entries_entry_date_unique UNIQUE (entry_date);
