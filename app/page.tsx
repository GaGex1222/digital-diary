"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, EntryMeta, DiaryEntry, EntryMedia } from "@/lib/supabase";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── ffmpeg singleton ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegInstance: any = null;
let ffmpegLoading = false;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  while (ffmpegLoading) await new Promise((r) => setTimeout(r, 100));
  if (ffmpegInstance) return ffmpegInstance;
  ffmpegLoading = true;
  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
        "application/wasm"
      ),
    });
    ffmpegInstance = ff;
  } finally {
    ffmpegLoading = false;
  }
  return ffmpegInstance;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PendingMedia = { file: File; preview: string; type: "image" | "video" };

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ entries, selectedDate, onDayClick }: {
  entries: EntryMeta[];
  selectedDate: string;
  onDayClick: (date: string) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();
  const entryDates = new Set(entries.map((e) => e.entry_date));

  const jan1 = new Date(year, 0, 1);
  const start = new Date(jan1);
  start.setDate(start.getDate() - start.getDay());
  const dec31 = new Date(year, 11, 31);

  type Cell = { date: string; inYear: boolean; isToday: boolean; hasEntry: boolean; isFuture: boolean };
  const weeks: Cell[][] = [];
  const cur = new Date(start);
  while (cur <= dec31) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cur.toISOString().split("T")[0];
      week.push({ date: dateStr, inYear: cur.getFullYear() === year, isToday: dateStr === todayStr, hasEntry: entryDates.has(dateStr), isFuture: dateStr > todayStr });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels: { label: string; weekIdx: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const diff = Math.floor((first.getTime() - start.getTime()) / 86400000);
    monthLabels.push({ label: MONTHS_SHORT[m], weekIdx: Math.floor(diff / 7) });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-widest">
          {year} · {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="flex mb-1">
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find((l) => l.weekIdx === wi);
              return <div key={wi} style={{ width: 14, marginRight: 2 }} className="text-[9px] text-stone-400 overflow-visible whitespace-nowrap">{lbl ? lbl.label : ""}</div>;
            })}
          </div>
          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => {
                  const isSelected = day.date === selectedDate;
                  let bg = "";
                  if (!day.inYear) bg = "invisible pointer-events-none";
                  else if (day.isFuture) bg = "bg-stone-100 cursor-default";
                  else if (day.hasEntry) bg = "bg-green-500 hover:bg-green-400 cursor-pointer";
                  else bg = "bg-stone-200 hover:bg-stone-300 cursor-pointer";
                  return (
                    <div key={di} title={day.date} onClick={() => day.inYear && !day.isFuture && onDayClick(day.date)}
                      className={["w-[12px] h-[12px] rounded-[2px] transition-colors", bg, isSelected ? "ring-[1.5px] ring-stone-700 ring-offset-[1px]" : ""].join(" ")} />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <span className="text-[9px] text-stone-400">Less</span>
            {["bg-stone-200","bg-green-300","bg-green-400","bg-green-500"].map((c) => <div key={c} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />)}
            <span className="text-[9px] text-stone-400">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month Calendar ────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, entries, selectedDate, onDayClick, onPrevMonth, onNextMonth }: {
  year: number; month: number; entries: EntryMeta[]; selectedDate: string;
  onDayClick: (date: string) => void; onPrevMonth: () => void; onNextMonth: () => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const entryDates = new Set(entries.map((e) => e.entry_date));
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition text-lg leading-none">‹</button>
        <span className="text-sm font-medium text-stone-700">{MONTHS[month]} {year}</span>
        <button onClick={onNextMonth} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition text-lg leading-none">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => <div key={d} className="text-center text-[10px] text-stone-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const hasEntry = entryDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const day = parseInt(dateStr.split("-")[2]);
          return (
            <button key={i} onClick={() => !isFuture && onDayClick(dateStr)} disabled={isFuture}
              className={["relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-colors",
                isSelected ? "bg-stone-800 text-white" : "",
                !isSelected && isToday ? "bg-stone-100 font-semibold text-stone-800" : "",
                !isSelected && !isToday && !isFuture ? "hover:bg-stone-50 text-stone-700 cursor-pointer" : "",
                isFuture ? "text-stone-300 cursor-default" : "",
              ].join(" ")}>
              <span className="leading-none">{day}</span>
              {hasEntry && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-green-400" : "bg-green-500"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const todayStr = new Date().toISOString().split("T")[0];

  const [entries, setEntries] = useState<EntryMeta[]>([]);
  const [allNotes, setAllNotes] = useState<DiaryEntry[]>([]);
  const [entryMediaMap, setEntryMediaMap] = useState<Record<string, EntryMedia>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedMedia, setSavedMedia] = useState<EntryMedia[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────
  async function fetchEntries() {
    const year = new Date().getFullYear();
    const { data: entryData } = await supabase
      .from("diary_entries")
      .select("id, entry_date, title, content, image_url, created_at, updated_at")
      .gte("entry_date", `${year}-01-01`)
      .lte("entry_date", `${year}-12-31`)
      .order("entry_date", { ascending: false });
    const rows = entryData ?? [];
    setEntries(rows.map(({ id, entry_date, title }) => ({ id, entry_date, title })));
    setAllNotes(rows as DiaryEntry[]);

    if (rows.length > 0) {
      const { data: mediaData } = await supabase
        .from("entry_media")
        .select("id, entry_id, url, media_type, created_at")
        .in("entry_id", rows.map((r) => r.id))
        .order("created_at", { ascending: true });
      const map: Record<string, EntryMedia> = {};
      for (const m of mediaData ?? []) {
        if (!map[m.entry_id]) map[m.entry_id] = m as EntryMedia;
      }
      setEntryMediaMap(map);
    }
    setLoading(false);
  }

  async function loadEntryForDate(date: string) {
    setLoadingEntry(true);
    setTitle(""); setContent(""); setCurrentEntryId(null);
    setSavedMedia([]); setPendingMedia([]); setError(null);

    const { data } = await supabase
      .from("diary_entries")
      .select("id, title, content")
      .eq("entry_date", date)
      .maybeSingle();

    if (data) {
      setTitle(data.title);
      setContent(data.content);
      setCurrentEntryId(data.id);
      const { data: media } = await supabase
        .from("entry_media").select("*").eq("entry_id", data.id).order("created_at", { ascending: true });
      setSavedMedia((media ?? []) as EntryMedia[]);
    }
    setLoadingEntry(false);
  }

  useEffect(() => { fetchEntries(); }, []);
  useEffect(() => { loadEntryForDate(selectedDate); }, [selectedDate]);

  // ── Compression ──────────────────────────────────────────────────────────────
  function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })), "image/jpeg", quality);
      };
      img.src = url;
    });
  }

  async function compressVideo(file: File): Promise<File> {
    setCompressing(true);
    setCompressionProgress(0);
    try {
      const ff = await getFFmpeg();
      const { fetchFile } = await import("@ffmpeg/util");
      const ts = Date.now();
      const inName = `in_${ts}.mp4`;
      const outName = `out_${ts}.mp4`;
      ff.on("progress", ({ progress }: { progress: number }) => {
        setCompressionProgress(Math.round(Math.min(progress, 1) * 100));
      });
      await ff.writeFile(inName, await fetchFile(file));
      await ff.exec(["-i", inName, "-vcodec", "libx264", "-crf", "36", "-preset", "ultrafast", "-vf", "scale=640:-2", "-acodec", "aac", "-b:a", "64k", outName]);
      const data = await ff.readFile(outName);
      await ff.deleteFile(inName);
      await ff.deleteFile(outName);
      return new File([new Uint8Array(data as ArrayBuffer)], file.name.replace(/\.[^.]+$/, ".mp4"), { type: "video/mp4" });
    } finally {
      setCompressing(false);
    }
  }

  // ── Media handlers ───────────────────────────────────────────────────────────
  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      if (file.type.startsWith("video/")) {
        const compressed = await compressVideo(file);
        setPendingMedia((prev) => [...prev, { file: compressed, preview: URL.createObjectURL(compressed), type: "video" }]);
      } else {
        const compressed = await compressImage(file);
        setPendingMedia((prev) => [...prev, { file: compressed, preview: URL.createObjectURL(compressed), type: "image" }]);
      }
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (compressing) return;
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!files.length) return;
    for (const file of files) {
      if (file.type.startsWith("video/")) {
        const compressed = await compressVideo(file);
        setPendingMedia((prev) => [...prev, { file: compressed, preview: URL.createObjectURL(compressed), type: "video" }]);
      } else {
        const compressed = await compressImage(file);
        setPendingMedia((prev) => [...prev, { file: compressed, preview: URL.createObjectURL(compressed), type: "image" }]);
      }
    }
  }

  function removePendingMedia(idx: number) {
    setPendingMedia((prev) => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  }

  async function removeSavedMedia(media: EntryMedia) {
    const path = media.url.split("/diary-images/")[1];
    if (path) await supabase.storage.from("diary-images").remove([path]);
    await supabase.from("entry_media").delete().eq("id", media.id);
    setSavedMedia((prev) => prev.filter((m) => m.id !== media.id));
    fetchEntries();
  }

  async function uploadAllPendingMedia(entryId: string) {
    for (const item of pendingMedia) {
      const ext = item.type === "video" ? "mp4" : "jpg";
      const path = `${entryId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("diary-images").upload(path, item.file, { upsert: true });
      if (error) continue;
      const publicUrl = supabase.storage.from("diary-images").getPublicUrl(path).data.publicUrl;
      await supabase.from("entry_media").insert({ entry_id: entryId, url: publicUrl, media_type: item.type });
    }
    setPendingMedia([]);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function handleDayClick(date: string) {
    setSelectedDate(date);
    const d = toLocalDate(date);
    setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
  }
  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true); setError(null);

    let entryId = currentEntryId;
    const payload = { title: title.trim(), content: content.trim(), entry_date: selectedDate, updated_at: new Date().toISOString() };

    if (currentEntryId) {
      const { error } = await supabase.from("diary_entries").update(payload).eq("id", currentEntryId);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("diary_entries").insert(payload).select("id").single();
      if (error) { setError(error.message); setSaving(false); return; }
      entryId = data.id;
      setCurrentEntryId(data.id);
    }

    if (pendingMedia.length > 0 && entryId) await uploadAllPendingMedia(entryId);

    setSaving(false);
    fetchEntries();
    if (entryId) {
      const { data: media } = await supabase.from("entry_media").select("*").eq("entry_id", entryId).order("created_at", { ascending: true });
      setSavedMedia((media ?? []) as EntryMedia[]);
    }
  }

  async function handleDelete() {
    if (!currentEntryId) return;
    for (const m of savedMedia) {
      const path = m.url.split("/diary-images/")[1];
      if (path) await supabase.storage.from("diary-images").remove([path]);
    }
    await supabase.from("diary_entries").delete().eq("id", currentEntryId);
    setTitle(""); setContent(""); setCurrentEntryId(null);
    setSavedMedia([]); setPendingMedia([]);
    fetchEntries();
  }

  function formatSelectedDate(dateStr: string) {
    return toLocalDate(dateStr).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  const allMedia = [...savedMedia, ...pendingMedia];
  const isToday = selectedDate === todayStr;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-800">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-1 tracking-tight">My Diary</h1>
        <p className="text-stone-400 text-sm mb-8">A quiet place for your thoughts.</p>

        {/* Heatmap */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm mb-5">
          {loading ? <div className="h-24 flex items-center justify-center text-stone-300 text-sm">Loading…</div>
            : <Heatmap entries={entries} selectedDate={selectedDate} onDayClick={handleDayClick} />}
        </div>

        {/* Calendar */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm mb-5">
          <MonthCalendar year={calYear} month={calMonth} entries={entries} selectedDate={selectedDate}
            onDayClick={handleDayClick} onPrevMonth={prevMonth} onNextMonth={nextMonth} />
        </div>

        {/* Entry form */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-medium text-stone-800">{formatSelectedDate(selectedDate)}</p>
              <p className="text-xs text-stone-400 mt-0.5">{isToday ? "Today · " : ""}{currentEntryId ? "Edit entry" : "No entry yet"}</p>
            </div>
            {currentEntryId && (
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition shrink-0">Delete</button>
            )}
          </div>

          {loadingEntry ? (
            <div className="py-8 text-center text-stone-300 text-sm">Loading…</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
              <textarea placeholder="What's on your mind?" value={content} onChange={(e) => setContent(e.target.value)} required rows={6}
                className="w-full mb-4 px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300" />

              {/* Media grid */}
              {allMedia.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {savedMedia.map((m) => (
                    <div key={m.id} className="relative aspect-square group">
                      {m.media_type === "video" ? (
                        <video src={m.url} className="w-full h-full object-cover rounded-lg" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" className="w-full h-full object-cover rounded-lg" />
                      )}
                      <button type="button" onClick={() => removeSavedMedia(m)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        ×
                      </button>
                      {m.media_type === "video" && (
                        <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1 rounded">▶</span>
                      )}
                    </div>
                  ))}
                  {pendingMedia.map((m, i) => (
                    <div key={`p-${i}`} className="relative aspect-square group opacity-60">
                      {m.type === "video" ? (
                        <video src={m.preview} className="w-full h-full object-cover rounded-lg" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                      )}
                      <button type="button" onClick={() => removePendingMedia(i)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        ×
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1 rounded">pending</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Compress progress */}
              {compressing && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                    <span>Compressing video…</span>
                    <span>{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div className="bg-stone-600 h-1.5 rounded-full transition-all" style={{ width: `${compressionProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Drop zone */}
              <label
                className={[
                  "flex flex-col items-center justify-center gap-1.5 mb-4 w-full py-6 border-2 border-dashed rounded-xl cursor-pointer transition",
                  compressing ? "pointer-events-none opacity-50" : "",
                  dragOver ? "border-stone-500 bg-stone-100" : "border-stone-200 hover:border-stone-400 hover:bg-stone-50",
                ].join(" ")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <span className="text-2xl">📎</span>
                <span className="text-sm text-stone-400">
                  {dragOver ? "Drop to upload" : "Drop photos / videos here"}
                </span>
                <span className="text-xs text-stone-300">or click to browse</span>
                <input type="file" accept="image/*,video/*" multiple onChange={handleMediaChange} className="hidden" disabled={compressing} />
              </label>

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
              <button type="submit" disabled={saving || compressing}
                className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition">
                {saving ? "Saving…" : currentEntryId ? "Update" : "Save Entry"}
              </button>
            </form>
          )}
        </div>

        {/* All notes */}
        {!loading && allNotes.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">
              All entries · {allNotes.length}
            </h2>
            <ul className="space-y-3">
              {allNotes.map((note) => {
                const thumb = entryMediaMap[note.id];
                return (
                  <li key={note.id}>
                    <Link href={`/entry/${note.entry_date}`}
                      className="flex gap-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm hover:border-stone-300 transition group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="font-medium text-stone-800 group-hover:text-stone-900 truncate">{note.title}</span>
                          <span className="text-xs text-stone-400 shrink-0">
                            {toLocalDate(note.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-stone-500 line-clamp-2 whitespace-pre-wrap">{note.content}</p>
                      </div>
                      {thumb && (
                        thumb.media_type === "video" ? (
                          <video src={thumb.url} className="w-16 h-16 object-cover rounded-lg shrink-0" muted />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        )
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
