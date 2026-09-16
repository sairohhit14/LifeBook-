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
      setError("Search ran into trouble. " + err.message);
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
        <h2 className="text-3xl font-serif italic text-[#1A1A1A] tracking-tight flex items-center gap-2">
          <Search className="w-6 h-6 text-[#1A1A1A]" />
          <span>Universal Legacy Search</span>
        </h2>
        <p className="text-[#454A46] text-xs mt-1">Instantly scan across memories, timeline milestones, secure certificates, messages, and family circle directory.</p>
      </div>

      {/* Search Terminal Box */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8A8F8B]">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            required
            placeholder="Search your memories, people, or moments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-sm focus:outline-none focus:border-[#315C4A]"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-xs font-medium uppercase tracking-[0.12em] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Search</span>}
        </button>
      </form>

      {error && <div className="text-xs text-[#B4543E] bg-[#F9EFEB] p-3 border border-[#E8CDC4]">{error}</div>}

      {/* Results Panel */}
      {loading ? (
        <div className="text-center py-24 text-[#454A46] space-y-2">
          <Loader className="w-8 h-8 animate-spin mx-auto text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Searching global repository ledger...</span>
        </div>
      ) : results === null ? (
        <div className="text-center py-20 bg-white rounded-[16px] border border-[#E5E5E1] text-[#454A46] text-xs font-serif italic">
          Enter search terms above to inspect legacy artifacts.
        </div>
      ) : !hasResults ? (
        <div className="text-center py-20 bg-white rounded-[16px] border border-[#E5E5E1]">
          <h4 className="text-[#1A1A1A] font-serif italic text-lg">No Records Match Query</h4>
          <p className="text-[#454A46] text-xs mt-1">Try general keywords like "will", "graduation", "vacation" or relative names.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group: Memories */}
          {results.memories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#454A46] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Heart className="w-4 h-4 text-[#1A1A1A]" />
                <span>Memory Vault Matches ({results.memories.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.memories.map(m => (
                  <div key={m.id} className="p-4 rounded-[16px] bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#315C4A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]">{m.title}</h4>
                      <p className="text-[10px] text-[#454A46] mt-1 line-clamp-1 font-sans">{m.description}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("memories")} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
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
              <h3 className="text-xs font-semibold text-[#454A46] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Calendar className="w-4 h-4 text-[#1A1A1A]" />
                <span>Timeline Milestone Matches ({results.milestones.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.milestones.map(m => (
                  <div key={m.id} className="p-4 rounded-[16px] bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#315C4A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]">{m.title}</h4>
                      <p className="text-[10px] text-[#454A46] mt-1 uppercase font-mono">{m.category} • {m.date}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("timeline")} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
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
              <h3 className="text-xs font-semibold text-[#454A46] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Shield className="w-4 h-4 text-[#1A1A1A]" />
                <span>Secure Vault Matches ({results.documents.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.documents.map(d => (
                  <div key={d.id} className="p-4 rounded-[16px] bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#315C4A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]">{d.title}</h4>
                      <p className="text-[10px] text-[#454A46] mt-1 font-mono">{d.fileName} ({d.fileSize})</p>
                    </div>
                    <button onClick={() => onNavigateToTab("vault")} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
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
              <h3 className="text-xs font-semibold text-[#454A46] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Users className="w-4 h-4 text-[#1A1A1A]" />
                <span>Family Circle Matches ({results.family.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.family.map(f => (
                  <div key={f.id} className="p-4 rounded-[16px] bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#315C4A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]">{f.name}</h4>
                      <p className="text-[10px] text-[#454A46] mt-1 font-mono uppercase">{f.relationship} • {f.role}</p>
                    </div>
                    <button onClick={() => onNavigateToTab("family")} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
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
              <h3 className="text-xs font-semibold text-[#454A46] uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Lock className="w-4 h-4 text-[#1A1A1A]" />
                <span>Legacy Messages Matches ({results.messages.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.messages.map(msg => (
                  <div key={msg.id} className="p-4 rounded-[16px] bg-white border border-[#E5E5E1] flex justify-between items-center hover:border-[#315C4A] transition-colors">
                    <div>
                      <h4 className="font-serif italic text-sm text-[#1A1A1A]">{msg.title}</h4>
                      <p className="text-[10px] text-[#454A46] mt-1 font-sans">Recipient: {msg.recipientName} ({msg.recipientEmail})</p>
                    </div>
                    <button onClick={() => onNavigateToTab("messages")} className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A] hover:underline flex items-center cursor-pointer">
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
