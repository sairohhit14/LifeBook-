import React, { useState } from "react";
import { api } from "../api";
import { Memory, Milestone, DocumentFile, FamilyMember, LegacyMessage } from "../types";
import { Search, Loader, Heart, Calendar, Shield, Users, Lock, ChevronRight, Eye } from "lucide-react";

interface GlobalSearchProps {
  onNavigateToTab: (tab: string) => void;
}

export default function GlobalSearch({ onNavigateToTab }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [results, setResults] = useState<{
    memories: Memory[];
    milestones: Milestone[];
    documents: DocumentFile[];
    family: FamilyMember[];
    messages: LegacyMessage[];
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    try {
      const data = await api.globalSearch(query);
      setResults(data);
    } catch (err: any) {
      setError("Search query failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasResults = results && (
    results.memories.length > 0 ||
    results.milestones.length > 0 ||
    results.documents.length > 0 ||
    results.family.length > 0 ||
    results.messages.length > 0
  );

  return (
    <div id="search-root" className="space-y-6 animate-fade-in font-sans">
      <div className="pb-4 border-b border-[#E5E5E1]">
        <h2 className="text-3xl font-serif italic text-[#1A1A1A] tracking-tight flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
          <Search className="w-6 h-6 text-[#1A1A1A]" />
          <span>Universal Legacy Search</span>
        </h2>
        <p className="text-[#1A1A1A]/70 text-xs mt-1">Instantly scan across memories, timeline milestones, secure certificates, messages, and family circle directory.</p>
      </div>

      {/* Search Terminal Box */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#1A1A1A]/50">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            required
            placeholder="Type search terms (e.g., childhood, graduation, will, Chloe...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-sm focus:outline-none focus:border-[#1A1A1A]"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Search</span>}
        </button>
      </form>

      {error && <div className="text-xs text-red-700 bg-red-50 p-3 border border-red-200">{error}</div>}

      {/* Results Panel */}
      {loading ? (
        <div className="text-center py-24 text-[#1A1A1A]/70 space-y-2">
          <Loader className="w-8 h-8 animate-spin mx-auto text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Searching global repository ledger...</span>
        </div>
      ) : results === null ? (
        <div className="text-center py-20 bg-white rounded-none border border-[#E5E5E1] text-[#1A1A1A]/60 text-xs font-serif italic">
          Enter search terms above to inspect legacy artifacts.
        </div>
      ) : !hasResults ? (
        <div className="text-center py-20 bg-white rounded-none border border-[#E5E5E1]">
          <h4 className="text-[#1A1A1A] font-serif italic text-lg" style={{ fontFamily: "Georgia, serif" }}>No Records Match Query</h4>
          <p className="text-[#1A1A1A]/60 text-xs mt-1">Try general keywords like "will", "graduation", "vacation" or relative names.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group: Memories */}
          {results.memories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Heart className="w-4 h-4 text-[#1A1A1A]" />
                <span>Memory Vault Matches ({results.memories.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.memories.map(m => (
                  <div key={m.id} className="p-4 rounded-none bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#1A1A1A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{m.title}</h4>
                      <p className="text-[10px] text-[#1A1A1A]/60 mt-1 line-clamp-1 font-sans">{m.description}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("memories")} className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
                      <span>Go</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group: Milestones */}
          {results.milestones.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Calendar className="w-4 h-4 text-[#1A1A1A]" />
                <span>Timeline Milestone Matches ({results.milestones.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.milestones.map(m => (
                  <div key={m.id} className="p-4 rounded-none bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#1A1A1A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{m.title}</h4>
                      <p className="text-[10px] text-[#1A1A1A]/60 mt-1 uppercase font-mono">{m.category} • {m.date}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("timeline")} className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
                      <span>Go</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group: Secure Documents */}
          {results.documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Shield className="w-4 h-4 text-[#1A1A1A]" />
                <span>Secure Vault Matches ({results.documents.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.documents.map(d => (
                  <div key={d.id} className="p-4 rounded-none bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#1A1A1A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{d.title}</h4>
                      <p className="text-[10px] text-[#1A1A1A]/60 mt-1 font-mono">{d.fileName} ({d.fileSize})</p>
                    </div>
                    <button onClick={() => onNavigateToTab("vault")} className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
                      <span>Go</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group: Family */}
          {results.family.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Users className="w-4 h-4 text-[#1A1A1A]" />
                <span>Family Circle Matches ({results.family.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.family.map(f => (
                  <div key={f.id} className="p-4 rounded-none bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#1A1A1A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{f.name}</h4>
                      <p className="text-[10px] text-[#1A1A1A]/60 mt-1 font-mono uppercase">{f.relationship} • {f.role}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("family")} className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
                      <span>Go</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group: Scheduled Messages */}
          {results.messages.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#1A1A1A]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Lock className="w-4 h-4 text-[#1A1A1A]" />
                <span>Legacy Messages Matches ({results.messages.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.messages.map(msg => (
                  <div key={msg.id} className="p-4 rounded-none bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#1A1A1A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{msg.title}</h4>
                      <p className="text-[10px] text-[#1A1A1A]/60 mt-1 font-sans">Recipient: {msg.recipientName} ({msg.recipientEmail})</p>
                    </div>
                    <button onClick={() => onNavigateToTab("messages")} className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
                      <span>Go</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
