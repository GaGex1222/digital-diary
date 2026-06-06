"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function EntryPage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<{ id: string; url: string; media_type: string; drive_file_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("diary_entries")
        .select("id, title, content")
        .eq("entry_date", date)
        .maybeSingle();

      if (!data) {
        setNotFound(true);
      } else {
        setTitle(data.title);
        setContent(data.content);
        const { data: mediaData } = await supabase
          .from("entry_media")
          .select("id, url, media_type, drive_file_id")
          .eq("entry_id", data.id)
          .order("created_at", { ascending: true });
        setMedia(mediaData ?? []);
      }
      setLoading(false);
    }
    load();
  }, [date]);

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-300 text-sm">Loading…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
        <p className="text-stone-400 text-sm">No entry for this date.</p>
        <button onClick={() => router.back()} className="text-sm text-stone-500 hover:text-stone-800 transition">
          ← Go back
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => router.back()}
          className="text-sm text-stone-400 hover:text-stone-700 transition mb-10 inline-block"
        >
          ← Back
        </button>

        <p className="text-xs text-stone-400 mb-2 uppercase tracking-widest">{formatDate(date)}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-800 mb-8">{title}</h1>

        {media.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            {media.map((m) =>
              m.media_type === "video" ? (
                <iframe key={m.id} src={m.url} className={`w-full rounded-xl border-0 ${media.length === 1 ? "col-span-2 h-72" : "col-span-1 h-48"}`} allow="autoplay" allowFullScreen />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="" className={`w-full rounded-xl object-cover max-h-72 ${media.length === 1 ? "col-span-2" : "col-span-1"}`} />
              )
            )}
          </div>
        )}

        <p className="text-stone-600 text-base leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </main>
  );
}
