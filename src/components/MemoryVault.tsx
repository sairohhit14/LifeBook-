import React, { useState, useEffect } from "react";
import { Memory, MediaFile } from "../types";
import { api } from "../api";
import { 
  Heart, Plus, Search, Filter, Calendar, MapPin, Tag, Image, Video, Mic, 
  Trash2, Edit, X, Upload, Play, Film, AlertCircle, Loader, Eye,
  Grid, LayoutGrid, ChevronLeft, ChevronRight, Download, Maximize2, BookOpen
} from "lucide-react";

interface MemoryVaultProps {
  onMemoryChanged: () => void;
  guestMode?: boolean;
}

export default function MemoryVault({ onMemoryChanged, guestMode }: MemoryVaultProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all"); // 'all', 'image', 'video', 'audio'

  // View mode & active viewing state
  const [viewMode, setViewMode] = useState<'capsules' | 'gallery'>('capsules');
  
  // Form / Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [aiDescribing, setAiDescribing] = useState(false);

  // Input refs for file upload buttons
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const data = await api.getMemories();
      setMemories(data);
    } catch (err: any) {
      setError(err.message || "We couldn't open your memories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingMemory(null);
    setTitle("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setLocation("");
    setTagsInput("");
    setMediaFiles([]);
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (memory: Memory) => {
    setEditingMemory(memory);
    setTitle(memory.title);
    setDescription(memory.description);
    setDate(memory.date);
    setLocation(memory.location);
    setTagsInput(memory.tags.join(", "));
    setMediaFiles(memory.media);
    setError("");
    setIsFormOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(10); // Start progress bar

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));

        // Read file as Base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        // Call our full-stack server upload endpoint!
        const result = await api.uploadFile(file.name, base64Data, mediaType);

        const newMedia: MediaFile = {
          id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: mediaType,
          url: result.url,
          name: result.name
        };

        setMediaFiles(prev => [...prev, newMedia]);

        // Auto-generate description for uploaded image using Gemini API on backend
        if (mediaType === "image") {
          setAiDescribing(true);
          try {
            const descResult = await api.describeImage(base64Data);
            if (descResult && descResult.description) {
              setDescription(prev => {
                const prefix = prev ? prev.trim() + "\n\n" : "";
                return prefix + `📸 [AI Memory Vision: ${descResult.description}]`;
              });
            }
          } catch (descErr) {
            console.error("AI image description failed:", descErr);
          } finally {
            setAiDescribing(false);
          }
        }
      }
    } catch (err: any) {
      setError("We couldn't upload that file. " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    setMediaFiles(prev => prev.map(m => m.id === id ? { ...m, caption } : m));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !date) {
      setError("Title, description, and date are required.");
      return;
    }

    const parsedTags = tagsInput
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      title,
      description,
      date,
      location,
      tags: parsedTags,
      media: mediaFiles
    };

    try {
      if (editingMemory) {
        await api.updateMemory(editingMemory.id, payload);
      } else {
        await api.createMemory(payload);
      }
      setIsFormOpen(false);
      fetchMemories();
      onMemoryChanged(); // Trigger dashboard update
    } catch (err: any) {
      setError(err.message || "We couldn't save that memory. Please try again.");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this memory?")) return;
    try {
      await api.deleteMemory(id);
      fetchMemories();
      onMemoryChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't remove that memory. Please try again.");
    }
  };

  // Extract all unique tags across memories for filters
  const allTags = Array.from(new Set(memories.flatMap(m => m.tags)));

  // Filter memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = selectedTag ? m.tags.includes(selectedTag) : true;

    const matchesMedia = mediaFilter === "all" 
      ? true 
      : m.media.some(f => f.type === mediaFilter);

    return matchesSearch && matchesTag && matchesMedia;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Extract all photos across filtered memories for gallery navigation
  const allPhotos = filteredMemories.flatMap(memory => 
    memory.media
      .filter(f => f.type === "image")
      .map(file => ({ file, memory }))
  );

  const handleOpenMemoryDetails = (memory: Memory, initialMediaIndex: number = 0) => {
    setViewingMemory(memory);
    setActiveMediaIndex(initialMediaIndex);
  };

  const handleOpenMemoryByFileId = (memory: Memory, fileId: string) => {
    const idx = memory.media.findIndex(f => f.id === fileId);
    handleOpenMemoryDetails(memory, idx !== -1 ? idx : 0);
  };

  const handleOpenGalleryPhoto = (item: { file: MediaFile, memory: Memory }) => {
    const idx = item.memory.media.findIndex(f => f.id === item.file.id);
    handleOpenMemoryDetails(item.memory, idx !== -1 ? idx : 0);
  };

  const handlePrevMedia = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!viewingMemory || viewingMemory.media.length <= 1) return;
    setActiveMediaIndex(prev => (prev === 0 ? viewingMemory.media.length - 1 : prev - 1));
  };

  const handleNextMedia = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!viewingMemory || viewingMemory.media.length <= 1) return;
    setActiveMediaIndex(prev => (prev >= viewingMemory.media.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation listener inside modal
  useEffect(() => {
    if (!viewingMemory) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveMediaIndex(prev => (prev === 0 ? viewingMemory.media.length - 1 : prev - 1));
      } else if (e.key === "ArrowRight") {
        setActiveMediaIndex(prev => (prev >= viewingMemory.media.length - 1 ? 0 : prev + 1));
      } else if (e.key === "Escape") {
        setViewingMemory(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingMemory]);

  return (
    <div id="memory-vault-root" className="space-y-6 animate-fade-in text-[#1E2521]">
      <div id="vault-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1E2521] flex items-center gap-2">
            <Heart className="w-6 h-6 text-[#C9A66B]" />
            <span>Memory Vault</span>
          </h2>
          <p className="text-[#8A8F8B] text-xs">Preserve the stories, milestones, pictures, and records of your lifetime in high-fidelity capsules.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#F1EFEC] p-1 border border-[#E5E5E1] rounded-[24px]">
            <button
              onClick={() => setViewMode('capsules')}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors cursor-pointer rounded-[16px] ${
                viewMode === 'capsules' ? 'bg-[#C9A66B] text-[#1E2521] font-bold' : 'text-[#454A46] hover:text-[#1E2521]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Capsules</span>
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors cursor-pointer rounded-[16px] ${
                viewMode === 'gallery' ? 'bg-[#C9A66B] text-[#1E2521] font-bold' : 'text-[#454A46] hover:text-[#1E2521]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Photo Gallery ({allPhotos.length})</span>
            </button>
          </div>

          {!guestMode && (
            <button
              id="add-memory-btn"
              onClick={handleOpenCreateForm}
              className="px-5 py-2.5 bg-[#C9A66B] hover:bg-[#B08F55] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#C9A66B]/10 font-bold"
            >
              <Plus className="w-4 h-4 font-bold" />
              <span>Record New Memory</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <div id="filters-panel" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#EFE9DD]/60 p-4 rounded-[32px] border border-[#E5E5E1]">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B]"
          />
        </div>

        <div className="flex items-center gap-2 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-[#8A8F8B]" />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="bg-transparent text-[#1A1A1A] text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="all" className="bg-[#F1EFEC] text-[#1A1A1A]">All Media Types</option>
            <option value="image" className="bg-[#F1EFEC] text-[#1A1A1A]">Photos Only</option>
            <option value="video" className="bg-[#F1EFEC] text-[#1A1A1A]">Videos Only</option>
            <option value="audio" className="bg-[#F1EFEC] text-[#1A1A1A]">Voice recordings</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[24px] px-3 py-1.5">
          <Tag className="w-3.5 h-3.5 text-[#8A8F8B]" />
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-transparent text-[#1A1A1A] text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="" className="bg-[#F1EFEC] text-[#1A1A1A]">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag} className="bg-[#F1EFEC] text-[#1A1A1A]">{tag}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-start md:justify-center">
          <button 
            onClick={() => { setSearchQuery(""); setSelectedTag(""); setMediaFilter("all"); }}
            className="text-xs text-[#8A8F8B] hover:text-[#C9A66B] transition-colors cursor-pointer font-medium uppercase tracking-[0.12em] underline decoration-1"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#C9826B]/10 border border-[#C9826B]/20 text-[#B4543E] rounded-[24px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Memories Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#8A8F8B] gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#C9A66B]" />
          <span className="text-xs font-medium uppercase tracking-wider">Accessing your Memory Vault...</span>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-20 bg-[#EFE9DD] rounded-[32px] border border-[#E5E5E1] p-6 animate-fade-in">
          <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
            <Heart className="w-5 h-5 text-[#C9A66B]" />
          </div>
          <h3 className="text-lg font-serif italic text-[#1E2521]">Your story awaits</h3>
          <p className="text-[#8A8F8B] text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            {searchQuery || selectedTag || mediaFilter !== "all" 
              ? "No items match your active filters. Try resetting search fields."
              : "Welcome to your story ledger. Record your birth origins, childhood moments, achievements, or values."}
          </p>
          {!guestMode && !searchQuery && !selectedTag && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-5 py-2.5 bg-[#C9A66B] hover:bg-[#B08F55] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] cursor-pointer transition-colors shadow-md"
            >
              Log your First Memory
            </button>
          )}
        </div>
      ) : viewMode === 'gallery' ? (
        /* Photo Gallery Grid View */
        allPhotos.length === 0 ? (
          <div className="text-center py-20 bg-[#EFE9DD] rounded-[32px] border border-[#E5E5E1] p-6 animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
              <Image className="w-5 h-5 text-[#C9A66B]" />
            </div>
            <h3 className="text-lg font-serif italic text-[#1E2521]">The gallery is waiting</h3>
            <p className="text-[#8A8F8B] text-xs mt-1 max-w-sm mx-auto leading-relaxed">
              No photos match your active search filters or exist in your Memory Vault yet. Upload photos when creating memory entries.
            </p>
          </div>
        ) : (
          <div id="photos-gallery-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
            {allPhotos.map((item, idx) => (
              <div
                key={`${item.file.id}_${idx}`}
                onClick={() => handleOpenGalleryPhoto(item)}
                className="group relative aspect-square bg-[#FCFBF7] border border-[#E5E5E1] overflow-hidden cursor-pointer shadow-md rounded-[32px] hover:border-[#C9A66B]/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:-translate-y-1 transition-all duration-300"
              >
                <img 
                  src={item.file.url} 
                  alt={item.file.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 p-1.5 bg-[#141A16]/80 text-white rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity border border-[rgba(252,251,247,0.20)]">
                  <Maximize2 className="w-3.5 h-3.5 text-[#C9A66B]" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#141A16] via-[#141A16]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#C9A66B] truncate">{item.memory.title}</span>
                  <span className="text-xs font-serif italic line-clamp-1">{item.file.caption || item.file.name || "Vault Photo"}</span>
                  <span className="text-[9px] text-[#454A46] flex items-center gap-1 mt-1">
                    <Calendar className="w-2.5 h-2.5 text-[#C9A66B]" />
                    {new Date(item.memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Capsule Cards View (Optimized for Image Grids) */
        <div id="memories-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
          {filteredMemories.map(memory => {
            const firstImage = memory.media.find(f => f.type === "image");
            return (
              <div 
                key={memory.id} 
                onClick={() => handleOpenMemoryDetails(memory)}
                className="group relative aspect-square bg-[#FCFBF7] border border-[#E5E5E1] overflow-hidden cursor-pointer shadow-md rounded-[32px] hover:border-[#C9A66B]/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                {firstImage ? (
                  /* Image Capsule */
                  <>
                    <img 
                      src={firstImage.url} 
                      alt={memory.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    
                    {/* Minimal hover overlay for title description */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141A16] via-[#141A16]/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-3 flex flex-col justify-end text-white">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#C9A66B] truncate">{memory.title}</span>
                      <span className="text-[9px] text-[#454A46] mt-0.5">
                        {new Date(memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {/* Media count overlay badge */}
                    {memory.media.length > 1 && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="px-1.5 py-0.5 bg-[#141A16]/80 border border-[rgba(252,251,247,0.25)] text-[#FCFBF7] text-[9px] rounded-[16px] flex items-center justify-center font-bold">
                          +{memory.media.length - 1}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Compact Text Memoir Card */
                  <div className="p-4 w-full h-full flex flex-col justify-between bg-[#EFE9DD] hover:bg-[#F1EFEC] transition-colors">
                    <div className="space-y-1.5 overflow-hidden">
                      <span className="text-[8px] text-[#8A8F8B] font-medium uppercase tracking-[0.12em] flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-[#C9A66B]" />
                        {new Date(memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })}
                      </span>
                      <h4 className="font-serif italic text-sm text-white line-clamp-2 leading-tight">{memory.title}</h4>
                      <p className="text-[10px] text-[#8A8F8B] line-clamp-3 leading-relaxed font-sans">{memory.description}</p>
                    </div>

                    <div className="pt-2 border-t border-[#E5E5E1]/60 flex justify-between items-center text-[9px]">
                      <span className="text-[#C9A66B] font-medium uppercase tracking-[0.12em]">Read Memoir</span>
                      <BookOpen className="w-3.5 h-3.5 text-[#C9A66B]" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD / Upload Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#141A16]/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-[#FCFBF7] border border-[#E5E5E1] rounded-[32px] max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col text-[#1E2521] shadow-2xl">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center bg-[#F1EFEC]">
              <h3 className="font-serif italic text-xl text-[#1E2521]">
                {editingMemory ? "Edit Memory Entry" : "Record New Life Memory"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#8A8F8B] hover:text-[#1E2521] cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1 bg-[#FCFBF7]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Childhood summers at grandmother's barn"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider">Detailed Description / Story</label>
                  {aiDescribing && (
                    <span className="text-[10px] text-[#C9A66B] font-bold animate-pulse flex items-center gap-1 bg-[#C9A66B]/10 px-2 py-0.5 border border-[#C9A66B]/20 rounded-[16px]">
                      <Loader className="w-3 h-3 animate-spin text-[#C9A66B]" />
                      AI writing photo caption...
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="Record your thoughts, lessons, dialogues, and insights from this moment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B] leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider">Estimated Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="E.g., Seattle, WA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="childhood, travel, lessons, family"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-4 py-2 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[24px] text-[#1E2521] text-xs focus:outline-none focus:border-[#C9A66B] focus:ring-1 focus:ring-[#C9A66B]"
                />
              </div>

              {/* Media Upload Options */}
              <div className="space-y-2 pt-2 border-t border-[#E5E5E1]">
                <label className="text-xs font-semibold text-[#454A46] uppercase tracking-wider flex items-center justify-between">
                  <span>Attach Media Files</span>
                  <span className="text-[10px] text-[#8A8F8B]">Supports multi-photo, video, &amp; audio</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="border border-[#E5E5E1] bg-[#F1EFEC] hover:bg-[#EFE9DD] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-[24px] hover:border-[#C9A66B]/50"
                  >
                    <Image className="w-5 h-5 text-[#C9A66B] mb-1" />
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1E2521]">Add Photo</span>
                  </button>
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "image")}
                  />

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="border border-[#E5E5E1] bg-[#F1EFEC] hover:bg-[#EFE9DD] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-[24px] hover:border-[#7E9B89]/50"
                  >
                    <Video className="w-5 h-5 text-[#7E9B89] mb-1" />
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1E2521]">Add Video</span>
                  </button>
                  <input
                    type="file"
                    ref={videoInputRef}
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "video")}
                  />

                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="border border-[#E5E5E1] bg-[#F1EFEC] hover:bg-[#EFE9DD] p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-[24px] hover:border-[#315C4A]/50"
                  >
                    <Mic className="w-5 h-5 text-[#4E7A64] mb-1" />
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1E2521]">Voice Record</span>
                  </button>
                  <input
                    type="file"
                    ref={audioInputRef}
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "audio")}
                  />
                </div>

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#1E2521] font-medium uppercase">
                      <span>Uploading to secure media servers...</span>
                      <span className="text-[#C9A66B]">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F1EFEC] rounded-full overflow-hidden">
                      <div className="h-full bg-[#C9A66B] rounded-full transition-all duration-300" style={{ width: `${uploadProgress || 10}%` }}></div>
                    </div>
                  </div>
                )}

                {/* File Previews List with per-photo text/caption */}
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {mediaFiles.map(file => (
                      <div key={file.id} className="relative p-2 border border-[#E5E5E1] rounded-[24px] bg-[#F1EFEC] text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {file.type === "image" && file.url && (
                              <img src={file.url} alt="" className="w-10 h-10 object-cover rounded-[16px] border border-[#E5E5E1] flex-shrink-0" />
                            )}
                            {file.type === "image" && !file.url && <Image className="w-4 h-4 text-[#C9A66B] flex-shrink-0" />}
                            {file.type === "video" && <Video className="w-4 h-4 text-[#7E9B89] flex-shrink-0" />}
                            {file.type === "audio" && <Mic className="w-4 h-4 text-[#4E7A64] flex-shrink-0" />}
                            <span className="truncate text-[11px] text-[#1E2521] font-medium pr-4">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(file.id)}
                            className="text-[#8A8F8B] hover:text-[#B4543E] transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder={file.type === "image" ? "Photo text — e.g. Diwali at grandma's, 1998" : "Attachment note (optional)"}
                          value={file.caption || ""}
                          onChange={(e) => handleCaptionChange(file.id, e.target.value)}
                          maxLength={200}
                          className="w-full px-3 py-1.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] text-[11px] text-[#1E2521] focus:outline-none focus:border-[#C9A66B]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E5E5E1] flex justify-end gap-3 bg-[#F1EFEC] -mx-6 -mb-6 p-6 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E1] bg-[#FCFBF7] hover:bg-[#EFE9DD] text-[#454A46] hover:text-[#1E2521] rounded-[24px] text-xs font-medium uppercase tracking-[0.12em] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#C9A66B] hover:bg-[#B08F55] text-[#1E2521] rounded-[24px] text-xs font-medium uppercase tracking-[0.12em] cursor-pointer flex items-center gap-1 transition-colors shadow-md shadow-[#C9A66B]/10 font-bold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Entry Viewer Modal (Split-Pane interactive Gallery) */}
      {viewingMemory && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-hidden animate-fade-in"
          onClick={() => setViewingMemory(null)}
        >
          {/* Main Container */}
          <div 
            className="bg-[#2A322C] border border-[rgba(252,251,247,0.14)] rounded-[24px] max-w-6xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Pane - Interactive Media Viewer */}
            <div className="flex-1 bg-[#141A16] flex flex-col justify-between relative p-4 border-b md:border-b-0 md:border-r border-[rgba(252,251,247,0.14)] min-h-[320px] md:min-h-[520px]">
              
              {/* Main Media display area */}
              <div className="flex-1 flex items-center justify-center relative w-full h-[240px] md:h-auto min-h-0">
                {viewingMemory.media.length > 0 && viewingMemory.media[activeMediaIndex] ? (
                  (() => {
                    const activeFile = viewingMemory.media[activeMediaIndex];
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        {activeFile.type === "image" && (
                          <img 
                            key={activeFile.id}
                            src={activeFile.url} 
                            alt={activeFile.name} 
                            className="max-h-[42vh] md:max-h-[62vh] w-auto max-w-full object-contain rounded-[24px] shadow-xl animate-fade-in"
                          />
                        )}
                        {activeFile.type === "video" && (
                          <video 
                            key={activeFile.id}
                            src={activeFile.url} 
                            controls 
                            className="max-h-[42vh] md:max-h-[62vh] w-full rounded-[24px] shadow-xl animate-fade-in"
                          />
                        )}
                        {activeFile.type === "audio" && (
                          <div key={activeFile.id} className="w-full max-w-md p-6 flex flex-col items-center justify-center bg-[#1E2521]/80 rounded-[32px] border border-[rgba(252,251,247,0.14)] animate-fade-in">
                            <div className="w-16 h-16 bg-[#2A322C] rounded-full flex items-center justify-center text-[#4E7A64] mb-4 border border-[rgba(252,251,247,0.14)] shadow-md">
                              <Mic className="w-8 h-8 animate-pulse" />
                            </div>
                            <span className="text-xs text-[#C9C7C0] font-medium mb-3 truncate max-w-xs">{activeFile.name}</span>
                            <audio src={activeFile.url} controls className="w-full" />
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* Fallback for text memories */
                  <div className="text-center p-8 flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#1E2521] rounded-full flex items-center justify-center text-[#8A8F8B] mb-4 border border-[rgba(252,251,247,0.14)] shadow-inner">
                      <BookOpen className="w-10 h-10 text-[#C9A66B]/80" />
                    </div>
                    <h5 className="font-serif italic text-lg text-white">Written Capsule</h5>
                    <p className="text-xs text-[#8A8F8B] max-w-xs mt-1">This memory contains a written narrative and details, but no visual attachments.</p>
                  </div>
                )}

                {/* Floating Media navigation arrows (within this memory's media list) */}
                {viewingMemory.media.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevMedia}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-2 text-[#C9C7C0] hover:text-white bg-[#1E2521]/70 hover:bg-[#1E2521] border border-[rgba(252,251,247,0.10)] hover:scale-105 rounded-full transition-all cursor-pointer shadow-md"
                      title="Previous Media"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextMedia}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-[#C9C7C0] hover:text-white bg-[#1E2521]/70 hover:bg-[#1E2521] border border-[rgba(252,251,247,0.10)] hover:scale-105 rounded-full transition-all cursor-pointer shadow-md"
                      title="Next Media"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Thumbnail Selector and Counter */}
              {viewingMemory.media.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[rgba(252,251,247,0.14)]/60 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] uppercase font-medium tracking-wider text-[#8A8F8B] px-1">
                    <span className="flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-[#C9A66B]" />
                      <span>Media file {activeMediaIndex + 1} of {viewingMemory.media.length}</span>
                    </span>
                    <span className="text-[#8A8F8B] font-mono">
                      {viewingMemory.media[activeMediaIndex]?.type}
                    </span>
                  </div>
                  {viewingMemory.media[activeMediaIndex]?.caption && (
                    <p className="text-[11px] text-[#E8E6DF] italic font-serif px-1 line-clamp-2">
                      &ldquo;{viewingMemory.media[activeMediaIndex].caption}&rdquo;
                    </p>
                  )}

                  {/* Thumbnail Row */}
                  {viewingMemory.media.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1 max-w-full scrollbar-thin">
                      {viewingMemory.media.map((file, idx) => (
                        <div
                          key={file.id}
                          onClick={() => setActiveMediaIndex(idx)}
                          title={file.caption || file.name}
                          className={`flex-shrink-0 w-12 h-12 rounded-[24px] overflow-hidden border-2 cursor-pointer transition-all ${
                            idx === activeMediaIndex ? 'border-[#C9A66B] scale-105 shadow-md shadow-[#C9A66B]/10' : 'border-[rgba(252,251,247,0.12)] hover:border-[rgba(252,251,247,0.20)]'
                          }`}
                        >
                          {file.type === "image" && (
                            <img src={file.url} alt="" className="w-full h-full object-cover" />
                          )}
                          {file.type === "video" && (
                            <div className="w-full h-full bg-[#1E2521] flex items-center justify-center text-[#7E9B89]">
                              <Film className="w-5 h-5" />
                            </div>
                          )}
                          {file.type === "audio" && (
                            <div className="w-full h-full bg-[#1E2521] flex items-center justify-center text-[#4E7A64]">
                              <Mic className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Right Pane - Memory Metadata, Narrative, & Actions */}
            <div className="w-full md:w-80 lg:w-96 bg-[#1E2521]/60 p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-full space-y-6">
              
              <div className="space-y-4">
                {/* Top Navigation Back Button */}
                <button
                  onClick={() => setViewingMemory(null)}
                  className="w-full py-2 px-3 bg-[#2A322C] hover:bg-[#3A443D] text-[#E8E6DF] border border-[rgba(252,251,247,0.14)] hover:border-[rgba(252,251,247,0.16)] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#C9A66B]" />
                  <span>Back to Grid</span>
                </button>

                {/* Section Header */}
                <div>
                  <span className="text-[10px] text-[#C9A66B] font-medium uppercase tracking-[0.12em] block border-b border-[#C9A66B]/20 pb-1 mb-2">Memory Capsule details</span>
                  <h3 className="font-serif italic text-3xl text-white mt-1 leading-snug tracking-tight font-semibold hover:text-[#C9A66B] transition-colors">{viewingMemory.title}</h3>
                </div>

                {/* Date & Location Card */}
                <div className="p-4 bg-[#2A322C] border border-[rgba(252,251,247,0.14)]/80 rounded-[32px] space-y-2.5 shadow-inner">
                  <div className="flex items-center gap-2.5 text-xs text-[#E8E6DF]">
                    <Calendar className="w-4 h-4 text-[#C9A66B] flex-shrink-0" />
                    <span className="font-medium">
                      {new Date(viewingMemory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {viewingMemory.location && (
                    <div className="flex items-center gap-2.5 text-xs text-[#E8E6DF]">
                      <MapPin className="w-4 h-4 text-[#C9A66B] flex-shrink-0" />
                      <span className="truncate">{viewingMemory.location}</span>
                    </div>
                  )}
                </div>

                {/* The Written Narrative / Story */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] uppercase font-medium tracking-widest text-[#8A8F8B] flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#C9A66B]/80" />
                    <span>The Story</span>
                  </h5>
                  <div className="text-[13px] text-[#E8E6DF] leading-relaxed max-h-[160px] md:max-h-[240px] overflow-y-auto pr-2 font-sans whitespace-pre-line bg-[#1E2521]/90 p-4 border border-[rgba(252,251,247,0.14)] rounded-[32px] scrollbar-thin">
                    {viewingMemory.description}
                  </div>
                </div>

                {/* Hashtag List */}
                {viewingMemory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingMemory.tags.map(t => (
                      <span key={t} className="text-[10px] font-bold px-2.5 py-1 bg-[#C9A66B]/10 text-[#C9A66B] border border-[#C9A66B]/20 hover:border-[#C9A66B]/40 hover:bg-[#C9A66B]/20 transition-all rounded-[24px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions toolbar */}
              <div className="pt-4 border-t border-[rgba(252,251,247,0.14)]/60 flex flex-col gap-2">
                
                {/* Download Active Media File if exists */}
                {viewingMemory.media.length > 0 && viewingMemory.media[activeMediaIndex] && (
                  <a
                    href={viewingMemory.media[activeMediaIndex].url}
                    download={viewingMemory.media[activeMediaIndex].name || `media_${viewingMemory.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 bg-[#C9A66B] hover:bg-[#B08F55] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center justify-center gap-2 transition-colors cursor-pointer text-center shadow-md shadow-[#C9A66B]/10 font-bold"
                  >
                    <Download className="w-3.5 h-3.5 font-bold" />
                    <span>Download {viewingMemory.media[activeMediaIndex].type}</span>
                  </a>
                )}

                {/* Edit / Delete buttons if not guest mode */}
                {!guestMode && (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => {
                        const m = viewingMemory;
                        setViewingMemory(null);
                        handleOpenEditForm(m);
                      }}
                      className="flex-1 py-2.5 px-3 bg-[#2A322C] hover:bg-[#3A443D] text-[#E8E6DF] border border-[rgba(252,251,247,0.14)] hover:border-[rgba(252,251,247,0.16)] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        const id = viewingMemory.id;
                        setViewingMemory(null);
                        handleDeleteMemory(id);
                      }}
                      className="flex-1 py-2.5 px-3 bg-[#C9826B]/10 hover:bg-[#C9826B]/20 text-[#B4543E] border border-[#C9826B]/25 text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}

                {/* Explicit Back to Grid button */}
                <button
                  onClick={() => setViewingMemory(null)}
                  className="w-full py-2.5 px-3 bg-[#2A322C] hover:bg-[#2A322C] text-[#E8E6DF] border border-[rgba(252,251,247,0.14)] hover:border-[rgba(252,251,247,0.16)] text-xs font-medium uppercase tracking-[0.12em] rounded-[24px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#C9A66B]" />
                  <span>Back to Grid</span>
                </button>
              </div>

            </div>

            {/* Close Button on top right of the whole modal - Positioned at end of HTML structure to naturally stack on top */}
            <button 
              onClick={() => setViewingMemory(null)}
              className="absolute top-4 right-4 z-50 p-2 text-[#8A8F8B] hover:text-white bg-[#1E2521]/80 hover:bg-[#1E2521] border border-[rgba(252,251,247,0.10)] rounded-full transition-all cursor-pointer shadow-md"
              title="Close Details (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
