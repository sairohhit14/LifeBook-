import React, { useState, useEffect } from "react";
import { AIStory } from "../types";
import { api } from "../api";
import { 
  BookOpen, Plus, Loader, ChevronLeft, ChevronRight, X, Trash2, 
  Sparkles, Download, Share2, HelpCircle, ArrowRight, AlertCircle
} from "lucide-react";

interface BiographyBooksProps {
  onStoryGenerated: () => void;
  guestMode?: boolean;
}

export default function BiographyBooks({ onStoryGenerated, guestMode }: BiographyBooksProps) {
  const [stories, setStories] = useState<AIStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [biographyLength, setBiographyLength] = useState<'short' | 'medium' | 'biography'>("short");
  const [personalNotes, setPersonalNotes] = useState("");

  // Reading states
  const [activeStory, setActiveStory] = useState<AIStory | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const data = await api.getStories();
      setStories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load memoirs");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBiography = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsGenerating(true);

    try {
      const story = await api.generateStory(biographyLength, personalNotes);
      setStories(prev => [story, ...prev]);
      setActiveStory(story);
      setActiveChapterIndex(0);
      setPersonalNotes("");
      onStoryGenerated();
    } catch (err: any) {
      setError(err.message || "Memoir compilation failed. Ensure your Memory Vault is populated!");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteStory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this generated biography?")) return;
    try {
      await api.deleteStory(id);
      setStories(prev => prev.filter(s => s.id !== id));
      if (activeStory?.id === id) setActiveStory(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete story");
    }
  };

  return (
    <div id="biography-root" className="space-y-6 animate-fade-in font-sans">
      <div id="biography-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <BookOpen className="w-6 h-6 text-[#1A1A1A]" />
            <span>AI Biography Book Shelf</span>
          </h2>
          <p className="text-[#1A1A1A]/70 text-xs">Transform raw chronological memory vault items and oral testimonies into custom, structured biographical memoirs using Gemini AI.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-none text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container - Bookshelf + Generator Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Book Shelf (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-serif italic text-xl text-[#1A1A1A] pb-2 border-b border-[#E5E5E1]" style={{ fontFamily: "Georgia, serif" }}>Your Biography Bookshelf</h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#1A1A1A]/70 gap-3">
              <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
              <span className="text-xs font-semibold uppercase tracking-wider">Polishing memoirs...</span>
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-none border border-[#E5E5E1] p-6">
              <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Shelves are Empty</h3>
              <p className="text-[#1A1A1A]/60 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                No memoirs compiled yet. Add memories to your vault, choose a focal point on the right, and compile your biography.
              </p>
            </div>
          ) : (
            /* Styled Book Grid */
            <div id="bookshelf-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {stories.map(story => (
                <div 
                  key={story.id} 
                  onClick={() => { setActiveStory(story); setActiveChapterIndex(0); }}
                  className="p-8 rounded-none bg-white border border-[#E5E5E1] shadow-sm cursor-pointer hover:border-[#1A1A1A] transition-all flex flex-col justify-between relative overflow-hidden group min-h-[300px]"
                >
                  <div className="absolute right-0 bottom-0 w-32 h-32 bg-[#F1EFEC]/40 rounded-full blur-2xl group-hover:bg-[#F1EFEC]/80 transition-colors"></div>
                  
                  {/* Left Spine border */}
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#1A1A1A]"></div>

                  <div className="space-y-4 pl-3">
                    <span className="px-2.5 py-1 text-[9px] font-bold bg-[#1A1A1A] text-white uppercase tracking-widest font-mono">
                      {story.title.includes("Chronicle") ? "Historical Record" : "Digital Memoir"}
                    </span>
                    <h4 className="font-serif italic text-2xl text-[#1A1A1A] tracking-tight group-hover:underline transition-colors" style={{ fontFamily: "Georgia, serif" }}>{story.title}</h4>
                    <p className="text-xs text-[#1A1A1A]/80 line-clamp-4 leading-relaxed font-serif italic">
                      &ldquo;{story.chapters[0]?.content || "Chapters generated dynamically"}&rdquo;
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#E5E5E1] pl-3 flex justify-between items-center text-xs">
                    <span className="text-[#1A1A1A]/60 font-bold uppercase tracking-wider text-[10px]">{story.chapters.length} Chapters</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleDeleteStory(story.id, e)}
                        className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-200 text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Memoir Generator Form (Right 1 col) */}
        {!guestMode && (
          <div className="p-6 rounded-none bg-[#F1EFEC] border border-[#E5E5E1] space-y-6">
            <div className="flex items-center gap-2 text-[#1A1A1A]">
              <Sparkles className="w-5 h-5 text-[#1A1A1A]" />
              <h3 className="font-serif italic text-xl text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>AI Memoir Compiler</h3>
            </div>

            <p className="text-xs text-[#1A1A1A]/80 leading-relaxed font-sans">
              Our advanced narrative engine parses all memories logged in your vault, matches historical timelines, and uses Gemini to write a cohesive, professional-grade biography book.
            </p>

            <form onSubmit={handleGenerateBiography} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Book Narrative Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["short", "medium", "biography"] as const).map(len => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setBiographyLength(len)}
                      className={`py-2 text-[9px] font-bold uppercase rounded-none border transition-all cursor-pointer ${
                        biographyLength === len 
                          ? "bg-[#1A1A1A] border-[#1A1A1A] text-white" 
                          : "bg-white border-[#E5E5E1] text-[#1A1A1A]/70 hover:border-[#1A1A1A]"
                      }`}
                    >
                      {len === "short" && "Short (~2m)"}
                      {len === "medium" && "Medium (~5m)"}
                      {len === "biography" && "Bio (~10m)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Focus Prompts / Tone Guiding</label>
                <textarea
                  rows={4}
                  placeholder="E.g., Emphasize my world travels, the core business values I founded, and make the tone reflective yet optimistic."
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] leading-relaxed font-serif"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/95 text-white rounded-none text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isGenerating ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Compile AI Biography</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* REASSURANCE COMPILATION OVERLAY */}
      {isGenerating && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-50 animate-fade-in text-[#1A1A1A]">
          <div className="max-w-md w-full text-center space-y-6">
            <Loader className="w-12 h-12 text-[#1A1A1A] animate-spin mx-auto" />
            <h3 className="text-2xl font-serif italic text-[#1A1A1A] tracking-tight" style={{ fontFamily: "Georgia, serif" }}>Writing Your Life Memoir Book...</h3>
            
            <div className="p-6 rounded-none bg-[#F1EFEC] border border-[#E5E5E1] text-xs text-[#1A1A1A]/80 leading-relaxed text-left space-y-3 font-serif">
              <p className="font-bold text-[#1A1A1A] uppercase tracking-wider text-[10px]">Narrative Compilation Steps:</p>
              <ul className="space-y-1.5 list-disc list-inside font-medium font-sans text-xs">
                <li>Analyzing chronological dates &amp; timeline epochs</li>
                <li>Structuring narrative themes and values threads</li>
                <li>Polishing prose style using advanced literary models</li>
                <li>Finalizing elegant leather cover &amp; chapters indices</li>
              </ul>
            </div>
            <p className="text-[10px] text-[#1A1A1A]/60 font-mono font-bold uppercase tracking-wider">Please wait. Do not close this panel. This might take 10-15 seconds.</p>
          </div>
        </div>
      )}

      {/* FULL SCREEN DIGITAL BOOK READER */}
      {activeStory && (
        <div className="fixed inset-0 bg-[#F9F7F2] flex flex-col z-50 animate-fade-in text-[#1A1A1A] font-serif overflow-y-auto">
          {/* Header Controls */}
          <div className="p-4 bg-white border-b border-[#E5E5E1] flex justify-between items-center font-sans">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F1EFEC] text-[#1A1A1A] rounded-none border border-[#E5E5E1]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] text-[#1A1A1A]/60 uppercase font-mono tracking-widest font-bold">Biography Reader</span>
                <h4 className="text-sm font-bold text-[#1A1A1A] truncate max-w-sm">{activeStory.title}</h4>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(activeStory, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${activeStory.title.replace(/\s+/g, "_")}.json`;
                  a.click();
                }}
                className="px-4 py-2 border border-[#E5E5E1] bg-white text-[#1A1A1A] hover:bg-[#F1EFEC] rounded-none text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Download Memoir
              </button>
              <button 
                onClick={() => setActiveStory(null)}
                className="p-2 hover:bg-[#F1EFEC] border border-transparent hover:border-[#E5E5E1] text-[#1A1A1A] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Book Content Panel */}
          <div className="flex-1 flex flex-col md:flex-row max-w-5xl w-full mx-auto p-4 md:p-8 gap-8 items-stretch h-[80vh]">
            
            {/* Chapter Navigation Sidebar */}
            <div className="w-full md:w-64 bg-white rounded-none border border-[#E5E5E1] p-4 space-y-3 font-sans h-fit overflow-y-auto">
              <h5 className="text-[10px] font-bold text-[#1A1A1A]/50 uppercase tracking-widest pl-2">Chapter Index</h5>
              <div className="space-y-1">
                {activeStory.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChapterIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-none text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeChapterIndex === idx 
                        ? "bg-[#1A1A1A] text-white" 
                        : "text-[#1A1A1A]/70 hover:bg-[#F1EFEC]"
                    }`}
                  >
                    {idx + 1}. {ch.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Book Body (Right column) */}
            <div className="flex-1 rounded-none bg-white border border-[#E5E5E1] p-6 md:p-12 shadow-sm relative flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                {/* Chapter Title */}
                <div className="text-center space-y-2 border-b border-[#E5E5E1] pb-6">
                  <span className="text-[10px] text-[#1A1A1A]/60 font-mono tracking-widest font-bold uppercase">Chapter {activeChapterIndex + 1}</span>
                  <h3 className="text-2xl md:text-3xl font-serif italic text-[#1A1A1A] leading-tight" style={{ fontFamily: "Georgia, serif" }}>{activeStory.chapters[activeChapterIndex]?.title}</h3>
                </div>

                {/* Chapter Prose text */}
                <p className="text-[#1A1A1A]/90 text-sm md:text-base leading-relaxed whitespace-pre-line text-justify max-w-2xl mx-auto tracking-wide">
                  {activeStory.chapters[activeChapterIndex]?.content}
                </p>
              </div>

              {/* Page turn buttons */}
              <div className="flex justify-between items-center pt-8 border-t border-[#E5E5E1] mt-12 font-sans text-xs">
                <button
                  disabled={activeChapterIndex === 0}
                  onClick={() => setActiveChapterIndex(prev => Math.max(0, prev - 1))}
                  className="px-4 py-2 bg-white border border-[#E5E5E1] text-[#1A1A1A] hover:bg-[#F1EFEC] rounded-none flex items-center gap-1 cursor-pointer disabled:opacity-40 uppercase font-bold tracking-wider text-[10px]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev Chapter</span>
                </button>

                <span className="text-[#1A1A1A]/50 font-mono font-bold">Page {activeChapterIndex + 1} of {activeStory.chapters.length}</span>

                <button
                  disabled={activeChapterIndex === activeStory.chapters.length - 1}
                  onClick={() => setActiveChapterIndex(prev => Math.min(activeStory.chapters.length - 1, prev + 1))}
                  className="px-4 py-2 bg-white border border-[#E5E5E1] text-[#1A1A1A] hover:bg-[#F1EFEC] rounded-none flex items-center gap-1 cursor-pointer disabled:opacity-40 uppercase font-bold tracking-wider text-[10px]"
                >
                  <span>Next Chapter</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
