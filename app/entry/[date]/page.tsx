"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
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
  const [lightbox, setLightbox] = useState<{ url: string; type: string } | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLightbox]);

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
                <div key={m.id} className={`relative group ${media.length === 1 ? "col-span-2" : "col-span-1"}`}>
                  <iframe src={m.url} className={`w-full rounded-xl border-0 ${media.length === 1 ? "h-72" : "h-48"}`} allow="autoplay" allowFullScreen />
                  <button
                    onClick={() => setLightbox({ url: m.url, type: "video" })}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ⛶ Expand
                  </button>
                </div>
              ) : (
                <div key={m.id} className={`relative group ${media.length === 1 ? "col-span-2" : "col-span-1"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt=""
                    className="w-full rounded-xl object-cover max-h-72 cursor-pointer"
                    onClick={() => setLightbox({ url: m.url, type: "image" })}
                  />
                  <button
                    onClick={() => setLightbox({ url: m.url, type: "image" })}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ⛶ Expand
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {lightbox && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            <div
              className="relative max-w-5xl max-h-[90vh] w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeLightbox}
                className="absolute -top-10 right-0 text-white text-2xl font-light hover:text-stone-300 transition"
              >
                ✕
              </button>
              {lightbox.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt="" className="max-w-full max-h-[85vh] object-contain rounded-xl mx-auto block" />
              ) : (
                <iframe src={lightbox.url} className="w-full h-[70vh] rounded-xl border-0" allow="autoplay" allowFullScreen />
              )}
            </div>
          </div>
        )}

        <p className="text-stone-600 text-base leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </main>
  );
}
