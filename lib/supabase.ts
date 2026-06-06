import { createClient } from "@supabase/supabase-js";

export type DiaryEntry = {
  id: string;
  title: string;
  content: string;
  entry_date: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryMeta = {
  id: string;
  entry_date: string;
  title: string;
};

export type EntryMedia = {
  id: string;
  entry_id: string;
  url: string;
  media_type: "image" | "video";
  size_bytes: number | null;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
