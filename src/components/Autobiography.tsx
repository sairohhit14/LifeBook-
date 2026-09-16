import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BookOpen, Sparkles, Loader, AlertCircle, ChevronLeft, ChevronRight,
  Check, Pencil, RefreshCw, Share2, Eye, List, Type as TypeIcon, X,
} from "lucide-react";
import { api } from "../api";
import type { User } from "../types";

// -------------------------------------------------------------- public types
// Matches the shape returned by /api/autobiography (publicAuto).

interface ChapterPhoto { id: string; url: string | null; caption?: string }

interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  order: number;
  period?: string;
  sections: string[];
  status: "pending" | "generating" | "ready" | "failed";
  userEdited: boolean;
  memoryCount: number;
  photos: ChapterPhoto[];
  error?: string;
}

interface Auto {
  id: string;
  title: string;
  subtitle?: string;
  status: "empty" | "generating" | "ready_for_review" | "published" | "failed";
  narrativeStyle: string;
  perspective: "first" | "third" | "legacy";
  progress: { total: number; done: number };
  lastError?: string;
  updatedAt: string;
  publishedAt?: string;
  chapters: Chapter[];
  conflicts?: { kind: string; subject: string; detail: string; memoryIds: string[] }[];
  memoryCount?: number;
  photoCount?: number;
  upToDate?: boolean | null;
  sourceCount?: number;
}

const STORAGE_KEY_READ = "lifebook_auto_reading";
const STORAGE_KEY_SIZE = "lifebook_auto_textsize";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Autobiography({ user, guestMode, onNavigate }: {
  user: User;
  guestMode: boolean;
  onNavigate?: (tab: string) => void;
}) {
  const [auto, setAuto] = useState<Auto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"book" | "read">("book");
  const [chapterIdx, setChapterIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editSections, setEditSections] = useState<string[]>([]);
  const [editCaptions, setEditCaptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [textSize, setTextSize] = useState<number>(() => loadJson(STORAGE_KEY_SIZE, 1));
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const readRootRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------- data load
  const load = useCallback(async () => {
    try {
      const data = await api.getAutobiography();
      setAuto(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || "We couldn't open your autobiography. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real progress polling while generating (§28 — bounded, status-driven)
  useEffect(() => {
    if (auto?.status !== "generating") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [auto?.status, load]);

  // Continue-reading bookmark (§15)
  useEffect(() => {
    if (view === "read" && auto?.chapters[chapterIdx]) {
      localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(auto.chapters[chapterIdx].id));
    }
  }, [view, chapterIdx, auto]);

  const refresh = useCallback(async () => {
    const data = await api.getAutobiography();
    setAuto(data);
  }, []);

  // ------------------------------------------------------------- actions
  const handleGenerate = async () => {
    setActionMsg(null);
    try {
      await api.generateAutobiography();
      await refresh();
    } catch (err: any) {
      setActionMsg(err.message || "We couldn't start writing right now. Please try again.");
    }
  };

  const handleRegenerate = async (chapterId: string) => {
    setActionMsg(null);
    try {
      await api.regenerateChapter(chapterId);
      await refresh();
    } catch (err: any) {
      setActionMsg(err.message || "We couldn't rewrite that chapter. Please try again.");
    }
  };

  const openEditor = (ch: Chapter) => {
    setEditTitle(ch.title);
    setEditSubtitle(ch.subtitle ?? "");
    setEditSections(ch.sections);
    setEditCaptions(Object.fromEntries(ch.photos.map((p) => [p.id, p.caption ?? ""])));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!auto) return;
    const ch = auto.chapters[chapterIdx];
    setSaving(true);
    try {
      const updated = await api.updateChapter(ch.id, {
        title: editTitle,
        subtitle: editSubtitle,
        sections: editSections,
        captions: editCaptions,
      });
      setAuto(updated);
      setEditing(false);
      setActionMsg("Chapter saved.");
    } catch (err: any) {
      setActionMsg(err.message || "We couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setActionMsg(null);
    try {
      const updated = auto.status === "published"
        ? await api.unpublishAutobiography()
        : await api.publishAutobiography();
      setAuto(updated);
      setActionMsg(updated.status === "published" ? "Your story is now visible to your family." : "Your story is private again.");
    } catch (err: any) {
      setActionMsg(err.message || "We couldn't update sharing. Please try again.");
    }
  };

  // ------------------------------------------------------- reading helpers
  const openChapter = (idx: number) => {
    setChapterIdx(idx);
    setView("read");
    setEditing(false);
    // restore last reading position when re-entering the book
    if (auto) {
      const lastId = loadJson<string | null>(STORAGE_KEY_READ, null);
      const lastIdx = auto.chapters.findIndex((c) => c.id === lastId);
      if (lastIdx >= 0) setChapterIdx(lastIdx);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const textPx = [17, 19, 22][textSize] ?? 19;
  const chapter = auto?.chapters[chapterIdx];
  const wordCount = chapter?.sections.join(" ").split(/\s+/).filter(Boolean).length ?? 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  // humanized progress (only real numbers, §28)
  const phase = (() => {
    if (!auto) return "";
    if (auto.status !== "generating") return "";
    const { total, done } = auto.progress;
    if (total === 0 || done >= total) return "Gathering your memories...";
    return `Writing chapter ${Math.min(done + 1, total)} of ${total}...`;
  })();

  // ------------------------------------------------------------- states
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 animate-fade-in">
        <div className="w-10 h-14 bg-[#F1EFEC] rounded-[10px] skeleton"></div>
        <span className="text-xs text-[#8A8F8B]">Opening your book...</span>
      </div>
    );
  }

  if (loadError && !auto) {
    return (
      <div className="p-4 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-sm flex items-center gap-2 max-w-xl mx-auto mt-12">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }

  if (!auto) return null;

  const emptyBook = auto.chapters.length === 0;

  // ------------------------------------------------------------- render
  return (
    <div id="autobiography-root" className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {actionMsg && (
        <div className="p-3 bg-[#E2EBE4] border border-[#B8C9BD] text-[#315C4A] text-xs rounded-[16px] flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} aria-label="Dismiss" className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {guestMode && auto.status !== "published" && (
        <div className="p-4 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] text-sm text-[#454A46] text-center">
          This story hasn't been shared yet.
        </div>
      )}

      {phase && (
        <div className="p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] flex items-center gap-3 shadow-sm">
          <Loader className="w-4 h-4 animate-spin text-[#315C4A] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-[#1E2521] font-serif italic">{phase}</p>
            {auto.progress.total > 0 && (
              <div className="w-full h-1.5 bg-[#E5E5E1] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-[#315C4A] transition-all duration-700 ease-out"
                  style={{ width: `${Math.round((auto.progress.done / auto.progress.total) * 100)}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "book" ? (
        <BookView
          auto={auto}
          user={user}
          guestMode={guestMode}
          emptyBook={emptyBook}
          onOpenChapter={openChapter}
          onGenerate={handleGenerate}
          onPublish={handlePublish}
          onNavigate={onNavigate}
          onRefresh={refresh}
        />
      ) : chapter ? (
        <div ref={readRootRef}>
          {editing ? (
            <ChapterEditor
              title={editTitle} setTitle={setEditTitle}
              subtitle={editSubtitle} setSubtitle={setEditSubtitle}
              sections={editSections} setSections={setEditSections}
              captions={editCaptions} setCaptions={setEditCaptions}
              photos={chapter.photos}
              saving={saving}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ReadingView
              chapter={chapter}
              index={chapterIdx}
              total={auto.chapters.length}
              textPx={textPx}
              readMinutes={readMinutes}
              textSize={textSize}
              onTextSize={setTextSize}
              onBack={() => setView("book")}
              onPrev={() => openChapter(Math.max(0, chapterIdx - 1))}
              onNext={() => openChapter(Math.min(auto.chapters.length - 1, chapterIdx + 1))}
              onEdit={() => openEditor(chapter)}
              onRegenerate={() => handleRegenerate(chapter.id)}
              guestMode={guestMode}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ============================== BOOK VIEW ============================== */

function BookView({ auto, user, guestMode, emptyBook, onOpenChapter, onGenerate, onPublish, onNavigate, onRefresh }: any) {
  const readyCount = auto.chapters.filter((c: Chapter) => c.status === "ready").length;
  const failedChapters = auto.chapters.filter((c: Chapter) => c.status === "failed");
  const isPublished = auto.status === "published";
  const years = (auto.chapters.map((c: Chapter) => c.period?.match(/\d{4}/g) ?? []).flat());
  const yearRange = years.length ? `${Math.min(...years.map(Number))} — Present` : undefined;

  return (
    <div className="space-y-8">
      {/* The Book Cover (§17) */}
      <div id="auto-cover" className="relative rounded-[24px] overflow-hidden border border-[#E5E5E1] shadow-md bg-[#FCFBF7] animate-rise-in">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E2EBE4]/60 via-transparent to-[#C9A66B]/10 pointer-events-none" aria-hidden="true"></div>
        <div className="relative p-10 md:p-14 flex flex-col items-center text-center gap-4">
          <span className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] bg-[#E2EBE4] border border-[#B8C9BD] text-[#315C4A] rounded-full">
            {isPublished ? "Shared with family" : "Private draft"}
          </span>
          <BookOpen className="w-8 h-8 text-[#C9A66B]" aria-hidden="true" />
          <h1 className="text-3xl md:text-5xl font-serif text-[#1E2521] leading-tight">
            {auto.title}
          </h1>
          {auto.subtitle && <p className="font-serif italic text-[#454A46]">{auto.subtitle}</p>}
          <p className="text-xs uppercase tracking-[0.15em] text-[#8A8F8B]">
            {user.name}{yearRange ? ` · ${yearRange}` : ""}
          </p>
          {auto.updatedAt && !emptyBook && (
            <p className="text-[11px] text-[#8A8F8B]">
              Last touched {new Date(auto.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {!emptyBook && readyCount > 0 && (
              <button
                onClick={() => onOpenChapter(0)}
                className="px-6 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] rounded-[10px] flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Continue reading
              </button>
            )}
            {!guestMode && (
              auto.status === "generating" ? (
                <span className="px-6 py-2.5 bg-[#F1EFEC] text-[#8A8F8B] text-xs uppercase tracking-[0.12em] rounded-[10px] flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" /> Writing your story...
                </span>
              ) : (
                <button
                  onClick={onGenerate}
                  className="px-6 py-2.5 bg-[#FCFBF7] hover:bg-[#F1EFEC] border border-[#E5E5E1] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] rounded-[10px] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#315C4A]" />
                  {emptyBook ? "Write my story" : auto.upToDate === false ? "Add new memories" : "Rewrite draft"}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Honest empty state (§25) */}
      {emptyBook ? (
        <div className="text-center py-16 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] px-6">
          <h2 className="text-xl font-serif italic text-[#1E2521]">Your story is waiting to be told</h2>
          <p className="text-sm text-[#454A46] mt-2 max-w-md mx-auto leading-relaxed">
            {auto.sourceCount === 0
              ? "Your autobiography grows from the memories you preserve. Add a few moments — a photograph, a place, a person — and your story will begin."
              : "Your memories are ready to become your story."}
          </p>
          {auto.sourceCount === 0 && onNavigate && !guestMode && (
            <button
              onClick={() => onNavigate("memories")}
              className="mt-5 px-5 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] rounded-[10px] cursor-pointer transition-colors"
            >
              Add your first memory
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Source conflicts (§24) */}
          {!guestMode && (auto.conflicts ?? []).length > 0 && (
            <div className="p-4 bg-[#F7F0E0] border border-[#E5D5B3] rounded-[16px] text-xs text-[#8A6B3B]">
              <p className="font-semibold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Some memories contain different dates. Review before finalizing.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {(auto.conflicts ?? []).slice(0, 3).map((c: any, i: number) => <li key={i}>{c.detail}</li>)}
              </ul>
            </div>
          )}

          {/* Failed chapters (§29) */}
          {!guestMode && failedChapters.length > 0 && (
            <div className="p-4 bg-[#F9EFEB] border border-[#E8CDC4] rounded-[16px] text-xs text-[#B4543E] flex items-center justify-between gap-3">
              <span>{auto.lastError ?? "Some chapters could not be written."}</span>
              <button
                onClick={() => { onGenerate(); onRefresh(); }}
                className="px-3 py-1.5 bg-[#B4543E] hover:bg-[#9E4132] text-white rounded-[10px] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Retry
              </button>
            </div>
          )}

          {/* Table of contents (§15) */}
          <nav aria-label="Chapters" className="bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E5E1] flex items-center justify-between">
              <h2 className="font-serif italic text-lg text-[#1E2521]">Chapters</h2>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#8A8F8B]">
                {readyCount} of {auto.chapters.length} written
              </span>
            </div>
            <ol className="divide-y divide-[#E5E5E1]">
              {auto.chapters.map((ch: Chapter, i: number) => (
                <li key={ch.id}>
                  <button
                    onClick={() => onOpenChapter(i)}
                    aria-current={i === 0 ? "true" : undefined}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-[#F7F4ED] transition-colors text-left cursor-pointer"
                  >
                    <span className="font-serif text-lg text-[#C9A66B] w-8 text-right flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-serif text-[#1E2521] truncate">{ch.title}</span>
                      <span className="block text-[11px] text-[#8A8F8B] mt-0.5">
                        {ch.period ? `${ch.period} · ` : ""}{ch.memoryCount} memories{ch.photos.length ? ` · ${ch.photos.length} photos` : ""}
                      </span>
                    </span>
                    {ch.status === "ready" ? (
                      <Check className="w-4 h-4 text-[#7E9B89] flex-shrink-0" aria-label="Written" />
                    ) : ch.status === "failed" ? (
                      <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" aria-label="Needs retry" />
                    ) : (
                      <Loader className="w-4 h-4 animate-spin text-[#8A8F8B] flex-shrink-0" aria-label="Writing" />
                    )}
                    <ChevronRight className="w-4 h-4 text-[#8A8F8B] flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {/* Publish control (owner only) */}
          {!guestMode && readyCount === auto.chapters.length && auto.chapters.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={onPublish}
                className="px-6 py-2.5 bg-[#FCFBF7] hover:bg-[#F1EFEC] border border-[#B8C9BD] text-[#315C4A] text-xs font-medium uppercase tracking-[0.12em] rounded-[10px] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {isPublished ? "Make private again" : "Share with my family"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== READING VIEW ============================== */

function ReadingView({ chapter, index, total, textPx, readMinutes, textSize, onTextSize, onBack, onPrev, onNext, onEdit, onRegenerate, guestMode }: any) {
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <article className="space-y-6 animate-fade-in">
      {/* Reading chrome */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-[#FCFBF7] border border-[#E5E5E1] text-[#454A46] text-xs rounded-[10px] flex items-center gap-1.5 hover:bg-[#F1EFEC] transition-colors cursor-pointer"
        >
          <List className="w-3.5 h-3.5" /> Contents
        </button>
        <div className="flex items-center gap-2" role="group" aria-label="Text size">
          <TypeIcon className="w-3.5 h-3.5 text-[#8A8F8B]" aria-hidden="true" />
          {[0, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => onTextSize(s)}
              aria-pressed={textSize === s}
              aria-label={["Small", "Medium", "Large"][s] + " text"}
              className={`w-7 h-7 rounded-[10px] text-xs transition-colors cursor-pointer ${
                textSize === s ? "bg-[#315C4A] text-[#FCFBF7]" : "bg-[#F1EFEC] text-[#454A46] hover:bg-[#E5E5E1]"
              }`}
            >
              {["A", "A", "A"][s]}
            </button>
          ))}
        </div>
      </div>

      {/* Reading progress (§15) */}
      <div className="h-1 bg-[#E5E5E1] rounded-full overflow-hidden" aria-hidden="true">
        <div className="h-full bg-[#315C4A] transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>

      {/* The chapter itself */}
      <div className="bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] shadow-sm p-8 md:p-12">
        <header className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8A8F8B]">
            Chapter {index + 1} of {total} · {readMinutes} min read
          </p>
          <h1 className="text-3xl md:text-4xl font-serif text-[#1E2521] mt-2 leading-tight">{chapter.title}</h1>
          {chapter.subtitle && <p className="font-serif italic text-[#454A46] mt-2">{chapter.subtitle}</p>}
          {chapter.period && (
            <p className="text-xs text-[#8A8F8B] mt-3 uppercase tracking-[0.12em]">{chapter.period}</p>
          )}
        </header>

        <div className="space-y-5">
          {chapter.sections.map((p: string, i: number) => (
            <p key={i} className="text-[#1A1A1A] leading-[1.75] first-letter:font-serif" style={{ fontSize: textPx }}>
              {p}
            </p>
          ))}
        </div>

        {/* Photos woven into the story (§18/§19) */}
        {chapter.photos.length > 0 && (
          <div className={`mt-10 grid gap-4 ${chapter.photos.length > 1 ? "grid-cols-1 sm:grid-cols-2" : ""}`}>
            {chapter.photos.map((photo: ChapterPhoto) => (
              <figure key={photo.id} className="space-y-2">
                <img
                  src={photo.url ?? ""}
                  alt={photo.caption || "A preserved photograph"}
                  loading="lazy"
                  className="w-full object-cover rounded-[16px] border border-[#E5E5E1] shadow-sm"
                />
                {photo.caption && (
                  <figcaption className="text-[11px] text-[#454A46] font-serif italic text-center">{photo.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {/* Source provenance (§21) */}
        <footer className="mt-10 pt-4 border-t border-[#E5E5E1] flex items-center justify-between">
          <span className="text-[10px] text-[#8A8F8B]">
            Based on {chapter.memoryCount} preserved {chapter.memoryCount === 1 ? "memory" : "memories"}
            {chapter.userEdited ? " · edited by you" : ""}
          </span>
          {!guestMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-[#315C4A] hover:bg-[#E2EBE4] text-[11px] uppercase tracking-[0.1em] rounded-[10px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={onRegenerate}
                className="px-3 py-1.5 text-[#454A46] hover:bg-[#F1EFEC] text-[11px] uppercase tracking-[0.1em] rounded-[10px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rewrite
              </button>
            </div>
          )}
        </footer>
      </div>

      {/* Prev / next chapter */}
      <nav className="flex justify-between gap-3" aria-label="Chapter navigation">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="px-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] text-[#454A46] text-xs rounded-[10px] flex items-center gap-1.5 hover:bg-[#F1EFEC] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={onNext}
          disabled={index >= total - 1}
          className="px-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] text-[#454A46] text-xs rounded-[10px] flex items-center gap-1.5 hover:bg-[#F1EFEC] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </article>
  );
}

/* ============================== CHAPTER EDITOR ============================== */

function ChapterEditor({ title, setTitle, subtitle, setSubtitle, sections, setSections, captions, setCaptions, photos, saving, onSave, onCancel }: any) {
  return (
    <div className="bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] shadow-sm p-8 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-serif italic text-lg text-[#1E2521]">Edit chapter</h2>
        <span className="text-[10px] text-[#8A8F8B] uppercase tracking-[0.1em]">Your words are kept</span>
      </div>

      <div className="space-y-1">
        <label htmlFor="auto-ch-title" className="text-[10px] uppercase tracking-[0.12em] text-[#8A8F8B]">Chapter title</label>
        <input
          id="auto-ch-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="w-full px-3 py-2.5 bg-[#F7F4ED] border border-[#E5E5E1] rounded-[10px] text-sm text-[#1E2521] focus:outline-none focus:border-[#315C4A]"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="auto-ch-sub" className="text-[10px] uppercase tracking-[0.12em] text-[#8A8F8B]">Subtitle (optional)</label>
        <input
          id="auto-ch-sub"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={160}
          className="w-full px-3 py-2.5 bg-[#F7F4ED] border border-[#E5E5E1] rounded-[10px] text-sm text-[#1E2521] focus:outline-none focus:border-[#315C4A]"
        />
      </div>

      {sections.map((p: string, i: number) => (
        <div key={i} className="space-y-1">
          <label htmlFor={`auto-ch-p${i}`} className="text-[10px] uppercase tracking-[0.12em] text-[#8A8F8B]">
            Paragraph {i + 1}
          </label>
          <textarea
            id={`auto-ch-p${i}`}
            value={p}
            rows={4}
            onChange={(e) => {
              const next = [...sections];
              next[i] = e.target.value;
              setSections(next);
            }}
            className="w-full px-3 py-2.5 bg-[#F7F4ED] border border-[#E5E5E1] rounded-[10px] text-sm text-[#1A1A1A] leading-relaxed focus:outline-none focus:border-[#315C4A]"
          />
        </div>
      ))}

      {photos.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-[#E5E5E1]">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#8A8F8B]">Photo captions</span>
          {photos.map((ph: ChapterPhoto) => (
            <div key={ph.id} className="flex items-center gap-3">
              <img src={ph.url ?? ""} alt="" className="w-12 h-12 object-cover rounded-[10px] border border-[#E5E5E1]" />
              <input
                value={captions[ph.id] ?? ""}
                onChange={(e) => setCaptions({ ...captions, [ph.id]: e.target.value })}
                maxLength={200}
                aria-label={`Caption for photo ${ph.id}`}
                placeholder="A short, factual caption..."
                className="flex-1 px-3 py-2 bg-[#F7F4ED] border border-[#E5E5E1] rounded-[10px] text-xs text-[#1E2521] focus:outline-none focus:border-[#315C4A]"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[#454A46] text-xs uppercase tracking-[0.1em] hover:bg-[#F1EFEC] rounded-[10px] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] rounded-[10px] flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
        >
          {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
