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
      setError(err.message || "Failed to load memories");
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
      setError("File upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
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
      setError(err.message || "Failed to save memory");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this memory?")) return;
    try {
      await api.deleteMemory(id);
      fetchMemories();
      onMemoryChanged();
    } catch (err: any) {
      setError(err.message || "Failed to delete memory");
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
    <div id="memory-vault-root" className="space-y-6 animate-fade-in text-slate-100">
      <div id="vault-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-700">
        <div>
          <h2 className="text-3xl font-serif italic text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-amber-500" />
            <span>Memory Vault</span>
          </h2>
          <p className="text-slate-400 text-xs">Preserve the stories, milestones, pictures, and records of your lifetime in high-fidelity capsules.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-800 p-1 border border-slate-700 rounded-lg">
            <button
              onClick={() => setViewMode('capsules')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer rounded-md ${
                viewMode === 'capsules' ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Capsules</span>
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer rounded-md ${
                viewMode === 'gallery' ? 'bg-amber-500 text-slate-900 font-bold' : 'text-slate-300 hover:text-white'
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
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-905 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/10 font-bold"
            >
              <Plus className="w-4 h-4 font-bold" />
              <span>Record New Memory</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <div id="filters-panel" className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="all" className="bg-slate-800 text-slate-200">All Media Types</option>
            <option value="image" className="bg-slate-800 text-slate-200">Photos Only</option>
            <option value="video" className="bg-slate-800 text-slate-200">Videos Only</option>
            <option value="audio" className="bg-slate-800 text-slate-200">Voice recordings</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
          <Tag className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-transparent text-slate-200 text-xs focus:outline-none w-full cursor-pointer font-medium"
          >
            <option value="" className="bg-slate-800 text-slate-200">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag} className="bg-slate-800 text-slate-200">{tag}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-start md:justify-center">
          <button 
            onClick={() => { setSearchQuery(""); setSelectedTag(""); setMediaFilter("all"); }}
            className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer font-bold uppercase tracking-wider underline decoration-1"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Memories Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Accessing your Memory Vault...</span>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/40 rounded-xl border border-slate-700 p-6 animate-fade-in">
          <div className="mx-auto w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-slate-700">
            <Heart className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-lg font-serif italic text-white">No Memories Found</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            {searchQuery || selectedTag || mediaFilter !== "all" 
              ? "No items match your active filters. Try resetting search fields."
              : "Welcome to your story ledger. Record your birth origins, childhood moments, achievements, or values."}
          </p>
          {!guestMode && !searchQuery && !selectedTag && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors shadow-md"
            >
              Log your First Memory
            </button>
          )}
        </div>
      ) : viewMode === 'gallery' ? (
        /* Photo Gallery Grid View */
        allPhotos.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/40 rounded-xl border border-slate-700 p-6 animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-slate-700">
              <Image className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-lg font-serif italic text-white">No Photos Available</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
              No photos match your active search filters or exist in your Memory Vault yet. Upload photos when creating memory entries.
            </p>
          </div>
        ) : (
          <div id="photos-gallery-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
            {allPhotos.map((item, idx) => (
              <div
                key={`${item.file.id}_${idx}`}
                onClick={() => handleOpenGalleryPhoto(item)}
                className="group relative aspect-square bg-slate-900 border border-slate-700 overflow-hidden cursor-pointer shadow-md rounded-xl hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:-translate-y-1 transition-all duration-300"
              >
                <img 
                  src={item.file.url} 
                  alt={item.file.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 p-1.5 bg-slate-950/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-450 truncate">{item.memory.title}</span>
                  <span className="text-xs font-serif italic line-clamp-1">{item.file.name || "Vault Photo"}</span>
                  <span className="text-[9px] text-slate-300 flex items-center gap-1 mt-1">
                    <Calendar className="w-2.5 h-2.5 text-amber-500" />
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
                className="group relative aspect-square bg-slate-900 border border-slate-700 overflow-hidden cursor-pointer shadow-md rounded-xl hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-350 p-3 flex flex-col justify-end text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-450 truncate">{memory.title}</span>
                      <span className="text-[9px] text-slate-300 mt-0.5">
                        {new Date(memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    {/* Media count overlay badge */}
                    {memory.media.length > 1 && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="px-1.5 py-0.5 bg-slate-955/80 border border-slate-700 text-slate-200 text-[9px] rounded-md flex items-center justify-center font-bold">
                          +{memory.media.length - 1}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Compact Text Memoir Card */
                  <div className="p-4 w-full h-full flex flex-col justify-between bg-slate-800/40 hover:bg-slate-800 transition-colors">
                    <div className="space-y-1.5 overflow-hidden">
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-amber-500" />
                        {new Date(memory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short' })}
                      </span>
                      <h4 className="font-serif italic text-sm text-white line-clamp-2 leading-tight">{memory.title}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-3 leading-relaxed font-sans">{memory.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center text-[9px]">
                      <span className="text-amber-450 font-bold uppercase tracking-wider">Read Memoir</span>
                      <BookOpen className="w-3.5 h-3.5 text-amber-500" />
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
        <div className="fixed inset-0 bg-slate-905/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col text-slate-100 shadow-2xl">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
              <h3 className="font-serif italic text-xl text-white">
                {editingMemory ? "Edit Memory Entry" : "Record New Life Memory"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1 bg-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Childhood summers at grandmother's barn"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Detailed Description / Story</label>
                  {aiDescribing && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20 rounded-md">
                      <Loader className="w-3 h-3 animate-spin text-amber-400" />
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
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Estimated Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="E.g., Seattle, WA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="childhood, travel, lessons, family"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Media Upload Options */}
              <div className="space-y-2 pt-2 border-t border-slate-750">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Attach Media Files</span>
                  <span className="text-[10px] text-slate-400">Supports multi-photo, video, &amp; audio</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="border border-slate-700 bg-slate-900 hover:bg-slate-800/80 p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-lg hover:border-amber-500/50"
                  >
                    <Image className="w-5 h-5 text-amber-500 mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200">Add Photo</span>
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
                    className="border border-slate-700 bg-slate-900 hover:bg-slate-800/80 p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-lg hover:border-sky-500/50"
                  >
                    <Video className="w-5 h-5 text-sky-400 mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200">Add Video</span>
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
                    className="border border-slate-700 bg-slate-900 hover:bg-slate-800/80 p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded-lg hover:border-emerald-500/50"
                  >
                    <Mic className="w-5 h-5 text-emerald-400 mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200">Voice Record</span>
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
                    <div className="flex justify-between text-[10px] text-slate-200 font-bold uppercase">
                      <span>Uploading to secure media servers...</span>
                      <span className="text-amber-400">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress || 10}%` }}></div>
                    </div>
                  </div>
                )}

                {/* File Previews List */}
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {mediaFiles.map(file => (
                      <div key={file.id} className="relative p-2 border border-slate-700 rounded-lg bg-slate-900 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {file.type === "image" && <Image className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                          {file.type === "video" && <Video className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                          {file.type === "audio" && <Mic className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                          <span className="truncate text-[11px] text-slate-200 font-medium pr-4">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(file.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-900 -mx-6 -mb-6 p-6 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-colors shadow-md shadow-amber-500/10 font-bold"
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
            className="bg-slate-800 border border-slate-700 rounded-2xl max-w-6xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Pane - Interactive Media Viewer */}
            <div className="flex-1 bg-slate-950 flex flex-col justify-between relative p-4 border-b md:border-b-0 md:border-r border-slate-700 min-h-[320px] md:min-h-[520px]">
              
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
                            className="max-h-[42vh] md:max-h-[62vh] w-auto max-w-full object-contain rounded-lg shadow-xl animate-fade-in"
                          />
                        )}
                        {activeFile.type === "video" && (
                          <video 
                            key={activeFile.id}
                            src={activeFile.url} 
                            controls 
                            className="max-h-[42vh] md:max-h-[62vh] w-full rounded-lg shadow-xl animate-fade-in"
                          />
                        )}
                        {activeFile.type === "audio" && (
                          <div key={activeFile.id} className="w-full max-w-md p-6 flex flex-col items-center justify-center bg-slate-900/80 rounded-xl border border-slate-700 animate-fade-in">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-emerald-400 mb-4 border border-slate-700 shadow-md">
                              <Mic className="w-8 h-8 animate-pulse" />
                            </div>
                            <span className="text-xs text-slate-300 font-medium mb-3 truncate max-w-xs">{activeFile.name}</span>
                            <audio src={activeFile.url} controls className="w-full" />
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* Fallback for text memories */
                  <div className="text-center p-8 flex flex-col items-center">
                    <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 mb-4 border border-slate-700 shadow-inner">
                      <BookOpen className="w-10 h-10 text-amber-500/80" />
                    </div>
                    <h5 className="font-serif italic text-lg text-white">Written Capsule</h5>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">This memory contains a written narrative and details, but no visual attachments.</p>
                  </div>
                )}

                {/* Floating Media navigation arrows (within this memory's media list) */}
                {viewingMemory.media.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevMedia}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-900 border border-slate-700/50 hover:scale-105 rounded-full transition-all cursor-pointer shadow-md"
                      title="Previous Media"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextMedia}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-900 border border-slate-700/50 hover:scale-105 rounded-full transition-all cursor-pointer shadow-md"
                      title="Next Media"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Thumbnail Selector and Counter */}
              {viewingMemory.media.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-400 px-1">
                    <span className="flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-amber-500" />
                      <span>Media file {activeMediaIndex + 1} of {viewingMemory.media.length}</span>
                    </span>
                    <span className="text-slate-500 font-mono">
                      {viewingMemory.media[activeMediaIndex]?.type}
                    </span>
                  </div>

                  {/* Thumbnail Row */}
                  {viewingMemory.media.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1 max-w-full scrollbar-thin">
                      {viewingMemory.media.map((file, idx) => (
                        <div
                          key={file.id}
                          onClick={() => setActiveMediaIndex(idx)}
                          className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            idx === activeMediaIndex ? 'border-amber-500 scale-105 shadow-md shadow-amber-500/10' : 'border-slate-750 hover:border-slate-500'
                          }`}
                        >
                          {file.type === "image" && (
                            <img src={file.url} alt="" className="w-full h-full object-cover" />
                          )}
                          {file.type === "video" && (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-sky-400">
                              <Film className="w-5 h-5" />
                            </div>
                          )}
                          {file.type === "audio" && (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-emerald-400">
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
            <div className="w-full md:w-80 lg:w-96 bg-slate-900/60 p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-full space-y-6">
              
              <div className="space-y-4">
                {/* Top Navigation Back Button */}
                <button
                  onClick={() => setViewingMemory(null)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-amber-500" />
                  <span>Back to Grid</span>
                </button>

                {/* Section Header */}
                <div>
                  <span className="text-[10px] text-amber-450 font-bold uppercase tracking-wider block border-b border-amber-500/20 pb-1 mb-2">Memory Capsule details</span>
                  <h3 className="font-serif italic text-3xl text-white mt-1 leading-snug tracking-tight font-semibold hover:text-amber-350 transition-colors">{viewingMemory.title}</h3>
                </div>

                {/* Date & Location Card */}
                <div className="p-4 bg-slate-850 border border-slate-700/80 rounded-xl space-y-2.5 shadow-inner">
                  <div className="flex items-center gap-2.5 text-xs text-slate-200">
                    <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="font-medium">
                      {new Date(viewingMemory.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {viewingMemory.location && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-200">
                      <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{viewingMemory.location}</span>
                    </div>
                  )}
                </div>

                {/* The Written Narrative / Story */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>The Story</span>
                  </h5>
                  <div className="text-[13px] text-slate-200 leading-relaxed max-h-[160px] md:max-h-[240px] overflow-y-auto pr-2 font-sans whitespace-pre-line bg-slate-900/90 p-4 border border-slate-700 rounded-xl scrollbar-thin">
                    {viewingMemory.description}
                  </div>
                </div>

                {/* Hashtag List */}
                {viewingMemory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingMemory.tags.map(t => (
                      <span key={t} className="text-[10px] font-bold px-2.5 py-1 bg-amber-500/10 text-amber-450 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/20 transition-all rounded-lg">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions toolbar */}
              <div className="pt-4 border-t border-slate-700/60 flex flex-col gap-2">
                
                {/* Download Active Media File if exists */}
                {viewingMemory.media.length > 0 && viewingMemory.media[activeMediaIndex] && (
                  <a
                    href={viewingMemory.media[activeMediaIndex].url}
                    download={viewingMemory.media[activeMediaIndex].name || `media_${viewingMemory.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer text-center shadow-md shadow-amber-500/10 font-bold"
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
                      className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-650 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold"
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
                      className="flex-1 py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}

                {/* Explicit Back to Grid button */}
                <button
                  onClick={() => setViewingMemory(null)}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-amber-500" />
                  <span>Back to Grid</span>
                </button>
              </div>

            </div>

            {/* Close Button on top right of the whole modal - Positioned at end of HTML structure to naturally stack on top */}
            <button 
              onClick={() => setViewingMemory(null)}
              className="absolute top-4 right-4 z-50 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-900 border border-slate-700/50 rounded-full transition-all cursor-pointer shadow-md"
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
