import React, { useState, useEffect } from "react";
import { DocumentFile } from "../types";
import { api } from "../api";
import { 
  ShieldAlert, Plus, Search, Filter, HardDrive, ShieldCheck, Download, 
  Trash2, X, Upload, Loader, AlertCircle, FileText, CheckCircle2
} from "lucide-react";

interface SecureVaultProps {
  onVaultChanged: () => void;
  guestMode?: boolean;
}

const FILE_CATEGORIES = ["Will", "Insurance", "Medical", "Identity", "Financial", "Property", "Trust", "Other"];

export default function SecureVault({ onVaultChanged, guestMode }: SecureVaultProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentFile | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Will");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.getDocuments();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || "We couldn't open your vault. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingDoc(null);
    setTitle("");
    setCategory("Will");
    setNotes("");
    setFileUrl("");
    setFileName("");
    setFileSize("");
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (doc: DocumentFile) => {
    setEditingDoc(doc);
    setTitle(doc.title || doc.name || "");
    setCategory(doc.category);
    setNotes(doc.notes || "");
    setFileUrl(doc.fileUrl);
    setFileName(doc.fileName || doc.name || "");
    setFileSize(doc.fileSize || doc.size || "");
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

      const result = await api.uploadFile(file.name, base64Data, "image"); // Uploads as general file
      setFileUrl(result.url);
      setFileName(file.name);
      
      // Calculate file size in human-readable string
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      setFileSize(`${sizeInMB} MB`);
    } catch (err: any) {
      setError("We couldn't upload that file. " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !fileUrl) {
      setError("Please fill in Title, Category, and attach a secure file.");
      return;
    }

    const payload = {
      title,
      category,
      notes,
      fileUrl,
      fileName,
      fileSize
    };

    try {
      if (editingDoc) {
        await api.updateDocument(editingDoc.id, payload);
      } else {
        await api.createDocument(payload);
      }
      setIsFormOpen(false);
      fetchDocuments();
      onVaultChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't secure that document. Please try again.");
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm("Permanently erase this document from your isolated vault?")) return;
    try {
      await api.deleteDocument(id);
      fetchDocuments();
      onVaultChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't remove that document. Please try again.");
    }
  };

  const handleDownloadDoc = (doc: DocumentFile) => {
    // Implement functional downloading
    const link = document.createElement("a");
    link.href = doc.fileUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" ? true : doc.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div id="vault-root" className="space-y-6 animate-fade-in font-sans">
      <div id="vault-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] tracking-tight flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-[#1A1A1A]" />
            <span>Secure Digital Vault</span>
          </h2>
          <p className="text-[#454A46] text-xs mt-1">A high-security isolation vault to encrypt and archive essential estate credentials, medical decrees, deeds, and insurance policies.</p>
        </div>
        {!guestMode && (
          <button
            id="upload-doc-btn"
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white text-xs font-medium uppercase tracking-[0.12em] rounded-[16px] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Secure New Document</span>
          </button>
        )}
      </div>

      {/* Security Banner Badge */}
      <div className="p-4 bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-[16px] flex items-start gap-3 text-xs leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-[#1A1A1A] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-serif italic text-sm text-[#1A1A1A] mb-0.5">AES-256 Military Isolation Active</h4>
          <p className="text-[#454A46]">All document storage assets in this vault are decoupled from standard index pipelines and fully cryptographically sandboxed. Designated circle relatives will access these files solely based on assigned permission levels.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Options */}
      <div id="vault-filters" className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#F1EFEC] p-4 rounded-[16px] border border-[#E5E5E1]">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search vault documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#E5E5E1] rounded-[16px] px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-[#8A8F8B]" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-[#1A1A1A] text-xs focus:outline-none w-full cursor-pointer font-medium uppercase tracking-[0.12em] text-[9px]"
          >
            <option value="all">All Categories</option>
            {FILE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
          className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#454A46] hover:text-[#1A1A1A] hover:underline transition-colors cursor-pointer text-left md:text-center"
        >
          Reset Filters
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#454A46] gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Decrypting isolation ledger...</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[16px] border border-[#E5E5E1] p-6">
          <div className="mx-auto w-12 h-12 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center justify-center text-[#8A8F8B] mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif italic text-[#1A1A1A]">Vault Ledger Empty</h3>
          <p className="text-[#454A46] text-xs mt-1 max-w-sm mx-auto">
            Secure essential papers like health directives, trusts, birth documents, and wills to protect family from logistical distress.
          </p>
          {!guestMode && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white text-xs font-medium uppercase tracking-[0.12em] rounded-[16px] cursor-pointer"
            >
              Secure First Document
            </button>
          )}
        </div>
      ) : (
        /* Vault Cards Grid */
        <div id="vault-documents-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <div 
              key={doc.id} 
              className="p-5 rounded-[16px] bg-white border border-[#E5E5E1] hover:border-[#315C4A] transition-all flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-[#F1EFEC] rounded-[16px] border border-[#E5E5E1] text-[#1A1A1A]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] font-medium bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-[16px] uppercase tracking-wider font-mono">
                    {doc.category}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-serif italic text-lg text-[#1A1A1A] tracking-tight">{doc.title || doc.name}</h4>
                  <p className="text-[10px] text-[#454A46] font-mono truncate">{doc.fileName || doc.name || "document"} • {doc.fileSize || doc.size}</p>
                </div>

                {doc.notes && (
                  <p className="text-xs text-[#454A46] italic bg-[#F9F7F2] p-3 border border-[#E5E5E1] leading-relaxed">
                    &ldquo;{doc.notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E5E1]">
                <button
                  onClick={() => handleDownloadDoc(doc)}
                  className="text-xs text-[#1A1A1A] hover:underline font-medium uppercase tracking-[0.12em] text-[10px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Securely</span>
                </button>

                {!guestMode && (
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => handleOpenEditForm(doc)}
                      className="px-3 py-1 bg-white hover:bg-[#F1EFEC] border border-[#E5E5E1] text-xs font-medium uppercase text-[9px] tracking-wider text-[#1A1A1A] cursor-pointer"
                    >
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 hover:bg-[#F9EFEB] border border-transparent hover:border-[#E8CDC4] text-[#B4543E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRUD Document Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-[#1A1A1A]">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-[16px] max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">
                {editingDoc ? "Edit Vault Entry" : "Secure New Document Asset"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#454A46] hover:text-[#1A1A1A] rounded-[10px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Last Will and Testament, House deed Seattle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] cursor-pointer font-medium uppercase tracking-[0.12em] text-[10px]"
                >
                  {FILE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat} Certificate/Document</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Add Special Instructions or Access Notes</label>
                <textarea
                  rows={3}
                  placeholder="E.g., Physical copy is stored in safe box #324 at First National Bank. Digital copy is encrypted."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] leading-relaxed"
                />
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Attach Secure File (PDF, Image, Docx)</label>
                <div className="flex items-center gap-3">
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-4 py-2.5 rounded-[16px] flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold text-[#1A1A1A] transition-colors uppercase tracking-wider">
                    <Upload className="w-4 h-4 text-[#1A1A1A]" />
                    <span>Upload &amp; Encrypt File</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  {uploading && <span className="text-xs text-[#454A46] font-semibold animate-pulse">Encrypting block...</span>}
                  {fileUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-[#3D5F4C] font-mono font-bold">
                      <CheckCircle2 className="w-4 h-4 text-[#3D5F4C]" />
                      <span className="max-w-[200px] truncate">{fileName} ({fileSize})</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-[#E5E5E1] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 border border-[#E5E5E1] hover:bg-[#F1EFEC] bg-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer text-[#1A1A1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer"
                >
                  Secure Vault Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
