-- Run this in your Supabase SQL Editor

create table diary_entries (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Allow public read/write (no auth for simplicity)
alter table diary_entries enable row level security;

create policy "Allow all" on diary_entries
  for all using (true) with check (true);
