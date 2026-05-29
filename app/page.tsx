"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, EntryMeta, DiaryEntry } from "@/lib/supabase";

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

// ── Heatmap ──────────────────────────────────────────────────────────────────
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
      week.push({
        date: dateStr,
        inYear: cur.getFullYear() === year,
        isToday: dateStr === todayStr,
        hasEntry: entryDates.has(dateStr),
        isFuture: dateStr > todayStr,
      });
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
          {/* Month labels */}
          <div className="flex mb-1">
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find((l) => l.weekIdx === wi);
              return (
                <div key={wi} style={{ width: 14, marginRight: 2 }} className="text-[9px] text-stone-400 overflow-visible whitespace-nowrap">
                  {lbl ? lbl.label : ""}
                </div>
              );
            })}
          </div>
          {/* Grid */}
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
                    <div
                      key={di}
                      title={day.date}
                      onClick={() => day.inYear && !day.isFuture && onDayClick(day.date)}
                      className={[
                        "w-[12px] h-[12px] rounded-[2px] transition-colors",
                        bg,
                        isSelected ? "ring-[1.5px] ring-stone-700 ring-offset-[1px]" : "",
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <span className="text-[9px] text-stone-400">Less</span>
            {["bg-stone-200","bg-green-300","bg-green-400","bg-green-500"].map((c) => (
              <div key={c} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
            ))}
            <span className="text-[9px] text-stone-400">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month Calendar ────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, entries, selectedDate, onDayClick, onPrevMonth, onNextMonth }: {
  year: number;
  month: number;
  entries: EntryMeta[];
  selectedDate: string;
  onDayClick: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const entryDates = new Set(entries.map((e) => e.entry_date));

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition text-lg leading-none">
          ‹
        </button>
        <span className="text-sm font-medium text-stone-700">{MONTHS[month]} {year}</span>
        <button onClick={onNextMonth} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition text-lg leading-none">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-stone-400 font-medium py-1">{d}</div>
        ))}
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
            <button
              key={i}
              onClick={() => !isFuture && onDayClick(dateStr)}
              disabled={isFuture}
              className={[
                "relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-colors",
                isSelected ? "bg-stone-800 text-white" : "",
                !isSelected && isToday ? "bg-stone-100 font-semibold text-stone-800" : "",
                !isSelected && !isToday && !isFuture ? "hover:bg-stone-50 text-stone-700 cursor-pointer" : "",
                isFuture ? "text-stone-300 cursor-default" : "",
              ].join(" ")}
            >
              <span className="leading-none">{day}</span>
              {hasEntry && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-green-400" : "bg-green-500"}`} />
              )}
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

  // image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  async function fetchEntries() {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("diary_entries")
      .select("id, entry_date, title, content, image_url, created_at, updated_at")
      .gte("entry_date", `${year}-01-01`)
      .lte("entry_date", `${year}-12-31`)
      .order("entry_date", { ascending: false });
    const rows = data ?? [];
    setEntries(rows.map(({ id, entry_date, title }) => ({ id, entry_date, title })));
    setAllNotes(rows as DiaryEntry[]);
    setLoading(false);
  }

  async function loadEntryForDate(date: string) {
    setLoadingEntry(true);
    setTitle("");
    setContent("");
    setCurrentEntryId(null);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setError(null);

    const { data } = await supabase
      .from("diary_entries")
      .select("id, title, content, image_url")
      .eq("entry_date", date)
      .maybeSingle();

    if (data) {
      setTitle(data.title);
      setContent(data.content);
      setCurrentEntryId(data.id);
      setExistingImageUrl(data.image_url ?? null);
      setImagePreview(data.image_url ?? null);
    }
    setLoadingEntry(false);
  }

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
        canvas.toBlob(
          (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };
      img.src = url;
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  }

  async function uploadImage(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${selectedDate}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("diary-images").upload(path, file, { upsert: true });
    if (error) { setError(error.message); return null; }
    return supabase.storage.from("diary-images").getPublicUrl(path).data.publicUrl;
  }

  useEffect(() => { fetchEntries(); }, []);
  useEffect(() => { loadEntryForDate(selectedDate); }, [selectedDate]);

  function handleDayClick(date: string) {
    setSelectedDate(date);
    const d = toLocalDate(date);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);

    let imageUrl: string | null = existingImageUrl;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) { setSaving(false); return; }
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      entry_date: selectedDate,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    if (currentEntryId) {
      const { error } = await supabase.from("diary_entries").update(payload).eq("id", currentEntryId);
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.from("diary_entries").insert(payload).select("id").single();
      if (error) setError(error.message);
      else setCurrentEntryId(data.id);
    }

    setSaving(false);
    fetchEntries();
  }

  async function handleDelete() {
    if (!currentEntryId) return;
    await supabase.from("diary_entries").delete().eq("id", currentEntryId);
    setTitle("");
    setContent("");
    setCurrentEntryId(null);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    fetchEntries();
  }

  function formatSelectedDate(dateStr: string) {
    return toLocalDate(dateStr).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  const isToday = selectedDate === todayStr;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-800">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-1 tracking-tight">My Diary</h1>
        <p className="text-stone-400 text-sm mb-8">A quiet place for your thoughts.</p>

        {/* Heatmap */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm mb-5">
          {loading ? (
            <div className="h-24 flex items-center justify-center text-stone-300 text-sm">Loading…</div>
          ) : (
            <Heatmap entries={entries} selectedDate={selectedDate} onDayClick={handleDayClick} />
          )}
        </div>

        {/* Calendar */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm mb-5">
          <MonthCalendar
            year={calYear}
            month={calMonth}
            entries={entries}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </div>

        {/* Entry form */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-medium text-stone-800">{formatSelectedDate(selectedDate)}</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {isToday ? "Today · " : ""}{currentEntryId ? "Edit entry" : "No entry yet"}
              </p>
            </div>
            {currentEntryId && (
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition shrink-0">
                Delete
              </button>
            )}
          </div>

          {loadingEntry ? (
            <div className="py-8 text-center text-stone-300 text-sm">Loading…</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full mb-3 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={6}
                className="w-full mb-4 px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              {/* Image upload */}
              <div className="mb-4">
                {imagePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-md transition"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-400 hover:text-stone-600 transition">
                    <span className="px-3 py-2 border border-dashed border-stone-300 rounded-lg hover:border-stone-400 transition">
                      + Add photo
                    </span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition"
              >
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
              {allNotes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/entry/${note.entry_date}`}
                    className="flex gap-4 bg-white border border-stone-200 rounded-xl p-5 shadow-sm hover:border-stone-300 transition group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="font-medium text-stone-800 group-hover:text-stone-900 truncate">
                          {note.title}
                        </span>
                        <span className="text-xs text-stone-400 shrink-0">
                          {toLocalDate(note.entry_date).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500 line-clamp-2 whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                    {note.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={note.image_url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg shrink-0"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
