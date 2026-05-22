"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase, DiaryEntry } from "@/lib/supabase";

export default function Home() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchEntries() {
    const { data, error } = await supabase
      .from("diary_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setEntries(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  function startEdit(entry: DiaryEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);

    if (editingId) {
      const { error } = await supabase
        .from("diary_entries")
        .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase
        .from("diary_entries")
        .insert({ title: title.trim(), content: content.trim() });
      if (error) setError(error.message);
    }

    setTitle("");
    setContent("");
    setEditingId(null);
    setSaving(false);
    fetchEntries();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("diary_entries").delete().eq("id", id);
    if (error) setError(error.message);
    else setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-800">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-1 tracking-tight">My Diary</h1>
        <p className="text-stone-400 text-sm mb-8">A quiet place for your thoughts.</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-10 bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">
            {editingId ? "Edit Entry" : "New Entry"}
          </h2>
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
            rows={5}
            className="w-full mb-4 px-3 py-2 border border-stone-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Save Entry"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Entries */}
        {loading ? (
          <p className="text-stone-400 text-sm text-center py-10">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-10">No entries yet. Write your first one above.</p>
        ) : (
          <ul className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-stone-800 truncate">{entry.title}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">{formatDate(entry.created_at)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-xs text-stone-500 hover:text-stone-800 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-stone-600 whitespace-pre-wrap">{entry.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
