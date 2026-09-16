import React, { useState, useEffect } from "react";
import { Milestone, MediaFile } from "../types";
import { api } from "../api";
import { 
  Calendar, MapPin, Plus, Edit, Trash2, X, Upload, Loader, 
  Award, Heart, GraduationCap, Briefcase, Compass, Home, BookOpen, AlertCircle
} from "lucide-react";

interface LifeTimelineProps {
  onTimelineChanged: () => void;
  guestMode?: boolean;
}

const CATEGORY_STYLES = {
  Childhood: { bg: "bg-[#1A1A1A] text-white", border: "border-[#1A1A1A]" },
  School: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  College: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Career: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Marriage: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Travel: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Achievement: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Family: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" },
  Other: { bg: "bg-[#F1EFEC] text-[#1A1A1A]", border: "border-[#E5E5E1]" }
};

export default function LifeTimeline({ onTimelineChanged, guestMode }: LifeTimelineProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<any>("Childhood");
  const [location, setLocation] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const data = await api.getTimeline();
      setMilestones(data);
    } catch (err: any) {
      setError(err.message || "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingMilestone(null);
    setTitle("");
    setDescription("");
    setDate("");
    setCategory("Childhood");
    setLocation("");
    setMediaUrl("");
    setMediaName("");
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setTitle(milestone.title);
    setDescription(milestone.description);
    setDate(milestone.date);
    setCategory(milestone.category);
    setLocation(milestone.location);
    setMediaUrl(milestone.media?.[0]?.url || "");
    setMediaName(milestone.media?.[0]?.name || "");
    setError("");
    setIsFormOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const result = await api.uploadFile(file.name, base64Data, "image");
      setMediaUrl(result.url);
      setMediaName(result.name);
    } catch (err: any) {
      setError("Failed to upload image: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !date || !category) {
      setError("Please fill in all required fields.");
      return;
    }

    const media: MediaFile[] = mediaUrl 
      ? [{ id: `med_${Date.now()}`, type: "image", url: mediaUrl, name: mediaName }]
      : [];

    const payload = {
      title,
      description,
      date,
      category,
      location,
      media
    };

    try {
      if (editingMilestone) {
        await api.updateMilestone(editingMilestone.id, payload);
      } else {
        await api.createMilestone(payload);
      }
      setIsFormOpen(false);
      fetchTimeline();
      onTimelineChanged();
    } catch (err: any) {
      setError(err.message || "Failed to save milestone");
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!window.confirm("Delete this life milestone?")) return;
    try {
      await api.deleteMilestone(id);
      fetchTimeline();
      onTimelineChanged();
    } catch (err: any) {
      setError(err.message || "Failed to delete milestone");
    }
  };

  // Sort milestones by date ascending
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Childhood": return <Home className="w-3.5 h-3.5" />;
      case "School": return <BookOpen className="w-3.5 h-3.5" />;
      case "College": return <GraduationCap className="w-3.5 h-3.5" />;
      case "Career": return <Briefcase className="w-3.5 h-3.5" />;
      case "Marriage": return <Heart className="w-3.5 h-3.5" />;
      case "Travel": return <Compass className="w-3.5 h-3.5" />;
      case "Achievement": return <Award className="w-3.5 h-3.5" />;
      case "Family": return <Home className="w-3.5 h-3.5" />;
      default: return <Award className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div id="timeline-root" className="space-y-6 animate-fade-in font-sans">
      <div id="timeline-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <Calendar className="w-6 h-6 text-[#1A1A1A]" />
            <span>Life Timeline</span>
          </h2>
          <p className="text-[#1A1A1A]/70 text-xs">Visualize the key milestones and golden moments of your existence on an interactive thread.</p>
        </div>
        {!guestMode && (
          <button
            id="add-milestone-btn"
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Milestone</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-none text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#1A1A1A]/70 gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Structuring life milestones...</span>
        </div>
      ) : sortedMilestones.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-none border border-[#E5E5E1] p-6">
          <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-serif italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Your Timeline is Empty</h3>
          <p className="text-[#1A1A1A]/60 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            Log your birth chapter, wedding days, degree milestones, moves, or key promotions to populate this life map.
          </p>
          {!guestMode && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer"
            >
              Add First Milestone
            </button>
          )}
        </div>
      ) : (
        /* Styled Vertical Thread Timeline */
        <div id="milestone-thread-container" className="relative pl-6 md:pl-12 py-4 space-y-12">
          {/* Thread Line */}
          <div className="absolute left-9 md:left-15 top-0 bottom-0 w-[1px] bg-[#E5E5E1]"></div>

          {sortedMilestones.map((milestone, index) => {
            const styles = CATEGORY_STYLES[milestone.category] || CATEGORY_STYLES.Other;
            const milestoneDate = new Date(milestone.date).toLocaleDateString("en-US", { year: "numeric", month: "long" });

            return (
              <div 
                key={milestone.id} 
                className="relative flex flex-col md:flex-row gap-6 items-start group animate-fade-in"
              >
                {/* Visual Connector Node */}
                <div 
                  className={`absolute -left-9 md:-left-15 top-1.5 w-6 h-6 rounded-full border bg-white flex items-center justify-center z-10 transition-transform group-hover:scale-110 border-[#1A1A1A] text-[#1A1A1A] shadow-sm`}
                >
                  {getCategoryIcon(milestone.category)}
                </div>

                {/* Milestone Card Content */}
                <div className="flex-1 p-6 rounded-none bg-white border border-[#E5E5E1] hover:border-[#1A1A1A] transition-all flex flex-col md:flex-row gap-6 shadow-sm">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold text-[#1A1A1A]/50 uppercase tracking-widest font-mono">{milestoneDate}</span>
                      <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-none border ${styles.border || 'border-[#E5E5E1]'} ${styles.bg} ${styles.text} uppercase tracking-wider`}>
                        {milestone.category}
                      </span>
                    </div>

                    <h4 className="font-serif italic text-xl text-[#1A1A1A] tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{milestone.title}</h4>
                    <p className="text-xs text-[#1A1A1A]/80 leading-relaxed whitespace-pre-line font-sans">{milestone.description}</p>

                    {milestone.location && (
                      <span className="text-[10px] text-[#1A1A1A]/60 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#1A1A1A]/50" />
                        <span>{milestone.location}</span>
                      </span>
                    )}

                    {!guestMode && (
                      <div className="flex gap-4 pt-2 border-t border-[#F1EFEC]">
                        <button 
                          onClick={() => handleOpenEditForm(milestone)}
                          className="text-[#1A1A1A]/70 hover:text-[#1A1A1A] hover:underline transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          className="text-red-700 hover:text-red-800 hover:underline transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Side Photo inside Card */}
                  {milestone.media && milestone.media.length > 0 && (
                    <div className="w-full md:w-48 aspect-video md:aspect-square rounded-none overflow-hidden bg-[#F1EFEC] border border-[#E5E5E1] flex-shrink-0 self-center">
                      <img src={milestone.media[0].url} alt={milestone.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD Milestone Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-[#1A1A1A]">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-none max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                {editingMilestone ? "Modify Life Milestone" : "Record New Milestone"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#1A1A1A]/60 hover:text-[#1A1A1A] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Milestone Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Graduation Day at University of Washington"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] cursor-pointer font-bold uppercase tracking-wider text-[10px]"
                  >
                    <option value="Childhood">Childhood &amp; Origins</option>
                    <option value="School">School Days</option>
                    <option value="College">College Era</option>
                    <option value="Career">Professional Career</option>
                    <option value="Marriage">Marriage &amp; Partnering</option>
                    <option value="Travel">World Travel</option>
                    <option value="Achievement">Defining Victory</option>
                    <option value="Family">Family Growth</option>
                    <option value="Other">Other Category</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Milestone Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Elaborate on why this moment matters, how it felt, and what doors it opened..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] leading-relaxed font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Location / Venue</label>
                <input
                  type="text"
                  placeholder="E.g., Seattle, WA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Attach Showcase Photo</label>
                <div className="flex items-center gap-3">
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-4 py-2.5 rounded-none flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-[#1A1A1A] transition-colors uppercase tracking-wider">
                    <Upload className="w-4 h-4 text-[#1A1A1A]" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  {uploading && <span className="text-xs text-[#1A1A1A]/60 font-semibold animate-pulse">Saving...</span>}
                  {mediaUrl && (
                    <span className="text-[10px] text-green-700 max-w-xs truncate font-mono font-bold">✓ {mediaName}</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#E5E5E1] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 border border-[#E5E5E1] hover:bg-[#F1EFEC] bg-white rounded-none text-[10px] font-bold uppercase tracking-wider cursor-pointer text-[#1A1A1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
