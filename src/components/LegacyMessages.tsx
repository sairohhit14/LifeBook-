import React, { useState, useEffect } from "react";
import { LegacyMessage } from "../types";
import { api } from "../api";
import { 
  Lock, Unlock, Plus, Mail, Clock, Calendar, MessageSquare, Mic, Video, 
  Trash2, Edit, X, Loader, AlertCircle, Play, Sparkles, Upload, RefreshCw
} from "lucide-react";

interface LegacyMessagesProps {
  onMessagesChanged: () => void;
  guestMode?: boolean;
}

export default function LegacyMessages({ onMessagesChanged, guestMode }: LegacyMessagesProps) {
  const [messages, setMessages] = useState<LegacyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<LegacyMessage | null>(null);
  const [viewingMessage, setViewingMessage] = useState<LegacyMessage | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [deliveryOption, setDeliveryOption] = useState<any>("Specific Date");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [type, setType] = useState<any>("text"); // 'text' | 'voice' | 'video'
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleForceDeliver = async (id: string) => {
    setDeliveringId(id);
    try {
      await api.deliverMessageInstantly(id);
      fetchMessages();
      onMessagesChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't deliver that message. Please try again.");
    } finally {
      setDeliveringId(null);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const data = await api.getMessages();
      setMessages(data);
    } catch (err: any) {
      setError(err.message || "We couldn't open your messages. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingMessage(null);
    setTitle("");
    setRecipientName("");
    setRecipientEmail("");
    setDeliveryOption("Specific Date");
    setDeliveryDate("");
    setDeliveryTime("");
    setType("text");
    setContent("");
    setMediaUrl("");
    setMediaName("");
    setError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (msg: LegacyMessage) => {
    setEditingMessage(msg);
    setTitle(msg.title);
    setRecipientName(msg.recipientName);
    setRecipientEmail(msg.recipientEmail);
    setDeliveryOption(msg.deliveryOption);
    setDeliveryDate(msg.deliveryDate || "");
    setDeliveryTime(msg.deliveryTime || "");
    setType(msg.type);
    setContent(msg.content);
    setMediaUrl(msg.mediaUrl || "");
    setMediaName(msg.mediaName || "");
    setError("");
    setIsFormOpen(true);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'voice' | 'video') => {
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

      const serverType = mediaType === "voice" ? "audio" : "video";
      const result = await api.uploadFile(file.name, base64Data, serverType);
      setMediaUrl(result.url);
      setMediaName(result.name);
    } catch (err: any) {
      setError("Attachment upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !recipientName || !recipientEmail || !content) {
      setError("Please fill in all required message fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setError("Recipient email doesn't look valid — the capsule can only be delivered to a real email address.");
      return;
    }

    let deliveryDateUtc = "";
    if (deliveryDate) {
      const timeStr = deliveryTime ? (deliveryTime.length === 5 ? `${deliveryTime}:00` : deliveryTime) : "00:00:00";
      const localDateTime = new Date(`${deliveryDate}T${timeStr}`);
      if (!isNaN(localDateTime.getTime())) {
        deliveryDateUtc = localDateTime.toISOString();
      }
    }

    const payload = {
      title,
      recipientName,
      recipientEmail,
      deliveryOption,
      deliveryDate,
      deliveryTime,
      deliveryDateUtc,
      type,
      content,
      mediaUrl,
      mediaName
    };

    try {
      if (editingMessage) {
        await api.updateMessage(editingMessage.id, payload);
      } else {
        await api.createMessage(payload);
      }
      setIsFormOpen(false);
      fetchMessages();
      onMessagesChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't schedule that message. Please try again.");
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm("Cancel this scheduled legacy message?")) return;
    try {
      await api.deleteMessage(id);
      fetchMessages();
      onMessagesChanged();
    } catch (err: any) {
      setError(err.message || "We couldn't cancel that message. Please try again.");
    }
  };

  return (
    <div id="messages-root" className="space-y-6 animate-fade-in font-sans">
      <div id="messages-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#1A1A1A]" />
            <span>Legacy Messages Capsule</span>
          </h2>
          <p className="text-[#454A46] text-xs">Write, record, and schedule digital time-capsule letters that deliver to family on designated future dates or milestones.</p>
          <p className="text-[#8A6B3B] text-[11px] mt-1">Real Gmail delivery needs a sender configured in Settings → Email Delivery Configuration (e.g. smtp.gmail.com + Gmail App Password). Without it, delivery is refused with an error instead of silently going nowhere.</p>
        </div>
        {!guestMode && (
          <button
            id="write-message-btn"
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white text-xs font-medium uppercase tracking-[0.12em] rounded-[16px] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Message</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#454A46] gap-3">
          <Loader className="w-8 h-8 animate-spin text-[#1A1A1A]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Preparing legacy capsules...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[16px] border border-[#E5E5E1] p-6">
          <div className="mx-auto w-12 h-12 bg-[#F1EFEC] rounded-full flex items-center justify-center text-[#1A1A1A] mb-4 border border-[#E5E5E1]">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-serif italic text-[#1A1A1A]">No Scheduled Messages</h3>
          <p className="text-[#454A46] text-xs mt-1 max-w-sm mx-auto leading-relaxed">
            Create an enduring voice message, video testimonial, or textual counsel locked until your grandchild's graduation or wedding anniversary.
          </p>
          {!guestMode && (
            <button
              onClick={handleOpenCreateForm}
              className="mt-4 px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white text-xs font-medium uppercase tracking-[0.12em] rounded-[16px] cursor-pointer"
            >
              Compose First Legacy Message
            </button>
          )}
        </div>
      ) : (
        /* Messages Cards Grid */
        <div id="messages-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {messages.map(msg => {
            const isDelivered = msg.status === "delivered";
            return (
              <div 
                key={msg.id} 
                className="rounded-[16px] bg-white border border-[#E5E5E1] p-5 shadow-sm flex flex-col justify-between hover:border-[#315C4A] transition-all group"
              >
                <div>
                  {/* Lock indicators */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] uppercase font-semibold text-[#1E2521]/70 flex items-center gap-1.5 font-mono">
                      {msg.type === "text" && <MessageSquare className="w-4 h-4 text-[#1A1A1A]" />}
                      {msg.type === "voice" && <Mic className="w-4 h-4 text-[#1A1A1A]" />}
                      {msg.type === "video" && <Video className="w-4 h-4 text-[#1A1A1A]" />}
                      <span>{msg.type} Capsule</span>
                    </span>

                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-[16px] flex items-center gap-1 border ${
                      isDelivered 
                        ? "bg-[#F4F7F4] text-[#3D5F4C] border-[#D3E0D6]" 
                        : msg.status === "failed"
                        ? "bg-[#F9EFEB] text-[#B4543E] border-[#E8CDC4] animate-pulse"
                        : "bg-[#F1EFEC] text-[#1A1A1A] border-[#E5E5E1]"
                    } uppercase tracking-wider font-mono`}>
                      {isDelivered ? (
                        <Unlock className="w-3 h-3" />
                      ) : msg.status === "failed" ? (
                        <AlertCircle className="w-3 h-3 text-[#B4543E]" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      <span>{msg.status}</span>
                    </span>
                  </div>

                  <h4 className="font-serif italic text-lg text-[#1A1A1A] line-clamp-1 group-hover:underline transition-all">{msg.title}</h4>
                  
                  {/* Recipient Details */}
                  <div className="mt-4 p-3 bg-[#F1EFEC] border border-[#E5E5E1] space-y-1.5 text-xs rounded-[16px]">
                    <div className="flex justify-between text-[#1A1A1A]">
                      <span className="text-[#454A46] font-medium">Recipient:</span>
                      <span className="font-bold">{msg.recipientName}</span>
                    </div>
                    <div className="flex justify-between text-[#1A1A1A]">
                      <span className="text-[#454A46] font-medium">Delivery Event:</span>
                      <span className="font-bold underline">{msg.deliveryOption}</span>
                    </div>
                    {msg.deliveryDate && (
                      <div className="flex justify-between text-[#1A1A1A]">
                        <span className="text-[#454A46] font-medium">Target Date:</span>
                        <span className="font-bold font-mono">
                          {(() => {
                            const parts = msg.deliveryDate.split('-');
                            if (parts.length === 3) {
                              const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                              return dateObj.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
                            }
                            return msg.deliveryDate;
                          })()}
                        </span>
                      </div>
                    )}
                    {msg.deliveryTime && (
                      <div className="flex justify-between text-[#1A1A1A]">
                        <span className="text-[#454A46] font-medium">Target Time:</span>
                        <span className="font-bold font-mono">{msg.deliveryTime}</span>
                      </div>
                    )}
                  </div>

                  {/* Locked teaser or content preview */}
                  <div className="mt-4 bg-white p-3 border border-[#E5E5E1]">
                    <p className="text-xs text-[#454A46] line-clamp-2 italic leading-relaxed font-serif">
                      &ldquo;{msg.content}&rdquo;
                    </p>
                  </div>

                  {/* Failed delivery error details */}
                  {msg.status === "failed" && msg.error && (
                    <div className="mt-3 p-2.5 bg-[#F9EFEB] border border-[#F2E2DC] text-[#B4543E] text-[10px] font-mono leading-relaxed rounded-[16px]">
                      <div className="font-bold mb-0.5 flex items-center gap-1 uppercase">
                        <AlertCircle className="w-3 h-3 text-[#B4543E]" />
                        <span>Transmission Error</span>
                      </div>
                      <p className="opacity-90">{msg.error}</p>
                    </div>
                  )}

                  {/* Delivered check & previewUrl option */}
                  {isDelivered && msg.previewUrl && (
                    <div className="mt-3 p-2.5 bg-[#F4F7F4] border border-[#E2EBE4] text-[#3D5F4C] text-[10px] font-mono leading-relaxed rounded-[16px]">
                      <div className="font-bold mb-1 flex items-center gap-1 uppercase">
                        <Unlock className="w-3 h-3 text-[#3D5F4C]" />
                        <span>Ethereal Outbox Link</span>
                      </div>
                      <p className="opacity-90 mb-2">This message was sent using the zero-config Ethereal test server. You can view the full styled email delivery in your browser:</p>
                      <a 
                        href={msg.previewUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-block bg-[#315C4A] text-white font-bold py-1 px-2.5 uppercase tracking-wider text-[9px] hover:bg-black transition-all"
                      >
                        Open Ethereal Mailbox
                      </a>
                    </div>
                  )}

                  {/* Instant Delivery trigger button for active testing */}
                  {!isDelivered && !guestMode && (
                    <button
                      onClick={() => handleForceDeliver(msg.id)}
                      disabled={deliveringId === msg.id}
                      className={`mt-3 w-full py-1.5 border text-[9px] font-medium uppercase tracking-[0.12em] transition-all rounded-[16px] cursor-pointer flex items-center justify-center gap-1.5 ${
                        msg.status === "failed"
                          ? "border-[#9E4132] text-[#B4543E] bg-[#F9EFEB] hover:bg-[#9E4132] hover:text-white"
                          : "border-[#315C4A] text-[#1A1A1A] hover:bg-[#315C4A] hover:text-white"
                      }`}
                    >
                      {deliveringId === msg.id ? (
                        <>
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                          <span>Routing SMTP Transmission...</span>
                        </>
                      ) : msg.status === "failed" ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-[#B4543E] animate-spin-slow" />
                          <span>Retry Delivery Now</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#C9A66B] animate-pulse" />
                          <span>Deliver Instantly (Test Run)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E5E1]">
                  <button 
                    onClick={() => setViewingMessage(msg)}
                    className="text-xs text-[#1A1A1A] hover:underline font-medium uppercase tracking-[0.12em] text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Preview Capsule</span>
                  </button>

                  {!guestMode && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenEditForm(msg)}
                        className="p-1.5 hover:bg-[#F1EFEC] border border-transparent hover:border-[#E5E5E1] text-[#454A46] hover:text-[#1A1A1A] cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 hover:bg-[#F9EFEB] border border-transparent hover:border-[#E8CDC4] text-[#B4543E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipient Inbox Simulator */}
      <div className="pt-10 border-t border-[#E5E5E1] mt-10">
        <div className="bg-[#315C4A] text-white p-6 rounded-[16px] space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="bg-[#C9A66B] text-[#1A1A1A] text-[10px] font-medium uppercase px-2 py-0.5 tracking-wider font-mono">Sandbox Simulator</span>
              <h3 className="text-xl font-serif italic mt-1">📬 Secure Recipient Inbox Simulator</h3>
              <p className="text-white/70 text-xs">Simulates the email account of your loved ones to inspect and read delivered time capsules in real time.</p>
            </div>
            <button
              onClick={() => {
                fetchMessages();
              }}
              className="px-3 py-1.5 bg-white text-[#1A1A1A] text-[10px] font-medium uppercase tracking-[0.12em] hover:bg-[#F1EFEC] transition-all rounded-[16px] cursor-pointer"
            >
              Check Mailbox Sync
            </button>
          </div>

          {messages.filter(m => m.status === "delivered").length === 0 ? (
            <div className="border border-white/20 p-8 text-center bg-white/[0.03]">
              <Mail className="w-8 h-8 text-white/40 mx-auto mb-2 animate-bounce" />
              <p className="text-xs text-white/60 font-semibold">No delivered capsule messages have reached recipient mailboxes yet.</p>
              <p className="text-[10px] text-white/40 mt-1">Hint: Change a trigger event to a specific date/time, wait 10 seconds for the backend scheduler, or click "Deliver Instantly (Test Run)".</p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#C9A66B] block font-mono">Delivered Capsules Inbox ({messages.filter(m => m.status === "delivered").length})</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {messages.filter(m => m.status === "delivered").map(msg => (
                  <div key={msg.id} className="bg-white text-[#1A1A1A] p-5 border-l-4 border-[#C9A66B] rounded-[16px] shadow-md flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center text-[10px] text-[#454A46] font-mono font-bold mb-2">
                        <span>TO: {msg.recipientName} ({msg.recipientEmail})</span>
                        <span className="bg-[#E2EBE4] text-[#3D5F4C] px-1.5 py-0.5 text-[8px] tracking-wider uppercase font-mono">✓ RECEIVED</span>
                      </div>
                      <h4 className="font-serif italic text-base font-semibold text-[#1A1A1A] border-b border-[#E5E5E1] pb-2">{msg.title}</h4>
                      <p className="text-xs text-[#454A46] mt-3 italic font-serif bg-[#F1EFEC] p-3 border border-[#E5E5E1] whitespace-pre-wrap leading-relaxed">
                        &ldquo;{msg.content}&rdquo;
                      </p>
                    </div>

                    {msg.mediaUrl && (
                      <div className="mt-3 p-2 bg-[#F7F0E0] border border-[#E5D5B3] flex items-center justify-between">
                        <span className="text-[10px] text-[#8A6B3B] font-bold flex items-center gap-1.5 truncate max-w-[70%]">
                          {msg.type === "voice" ? <Mic className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                          <span className="truncate">{msg.mediaName || "Media Capsule Attachment"}</span>
                        </span>
                        <a
                          href={msg.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] uppercase tracking-wider font-bold bg-[#315C4A] text-white px-2 py-1 hover:opacity-85 rounded-[16px] flex-shrink-0"
                        >
                          Open Attachment
                        </a>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[#E5E5E1] flex justify-between items-center text-[9px] text-[#8A8F8B] font-mono">
                      <span>Delivered securely: {msg.deliveredAt ? new Date(msg.deliveredAt).toLocaleString() : new Date().toLocaleString()}</span>
                      <span className="font-bold underline text-[#1A1A1A]">Legacy Secure</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRUD Message Capsule Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-[#1A1A1A]">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-[16px] max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center">
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">
                {editingMessage ? "Edit Legacy Message Capsule" : "Compose Enduring Time-Capsule"}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-[#454A46] hover:text-[#1A1A1A] rounded-[10px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Capsule Title / Occasion</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Letters for your 21st birthday, Wedding counseling advice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Recipient Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Granddaughter Chloe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Recipient Email</label>
                  <input
                    type="email"
                    required
                    placeholder="chloe@gmail.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Delivery Trigger Event</label>
                  <select
                    value={deliveryOption}
                    onChange={(e) => setDeliveryOption(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] cursor-pointer font-medium uppercase tracking-[0.12em] text-[10px]"
                  >
                    <option value="Specific Date">Specific Future Date</option>
                    <option value="Birthday">Birthday</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Graduation">Highschool / College Graduation</option>
                    <option value="Wedding">Wedding Day</option>
                    <option value="Custom Event">Custom Event Notification</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Target Time (Optional)</label>
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Message Type</label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-3 border rounded-[16px] flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    type === "text" 
                      ? "bg-[#315C4A] border-[#315C4A] text-white" 
                      : "bg-white border-[#E5E5E1] text-[#454A46] hover:border-[#315C4A]"
                  }`}>
                    <input type="radio" name="msgType" checked={type === "text"} onChange={() => setType("text")} className="hidden" />
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Text Capsule</span>
                  </label>

                  <label className={`flex-1 p-3 border rounded-[16px] flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    type === "voice" 
                      ? "bg-[#315C4A] border-[#315C4A] text-white" 
                      : "bg-white border-[#E5E5E1] text-[#454A46] hover:border-[#315C4A]"
                  }`}>
                    <input type="radio" name="msgType" checked={type === "voice"} onChange={() => setType("voice")} className="hidden" />
                    <Mic className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Voice Memo</span>
                  </label>

                  <label className={`flex-1 p-3 border rounded-[16px] flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    type === "video" 
                      ? "bg-[#315C4A] border-[#315C4A] text-white" 
                      : "bg-white border-[#E5E5E1] text-[#454A46] hover:border-[#315C4A]"
                  }`}>
                    <input type="radio" name="msgType" checked={type === "video"} onChange={() => setType("video")} className="hidden" />
                    <Video className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Video Testimony</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Enduring Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Record your counsel, wisdom, stories, blessings, or final letters..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] leading-relaxed font-sans"
                />
              </div>

              {type !== "text" && (
                <div className="space-y-1.5 pt-2 border-t border-[#E5E5E1]">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider flex items-center gap-1">
                    <span>Attach Oral recording/Video testimony</span>
                    <span className="text-[9px] text-[#8A8F8B] font-mono">(Simulated Upload)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-4 py-2.5 rounded-[16px] flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold text-[#1A1A1A] transition-colors uppercase tracking-wider">
                      <Upload className="w-4 h-4" />
                      <span>Upload media file</span>
                      <input
                        type="file"
                        accept={type === "voice" ? "audio/*" : "video/*"}
                        className="hidden"
                        onChange={(e) => handleMediaUpload(e, type)}
                      />
                    </label>
                    {uploading && <span className="text-xs text-[#454A46] font-semibold animate-pulse">Archiving...</span>}
                    {mediaUrl && (
                      <span className="text-[10px] text-[#3D5F4C] max-w-xs truncate font-mono font-bold">✓ {mediaName}</span>
                    )}
                  </div>
                </div>
              )}

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
                  Schedule Message Capsule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEWING PREVIEW MODAL */}
      {viewingMessage && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-[#1A1A1A]">
          <div className="bg-[#F9F7F2] border border-[#E5E5E1] rounded-[16px] max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-[#E5E5E1] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#1A1A1A] animate-pulse" />
                <h3 className="font-serif italic text-xl text-[#1A1A1A]">Legacy Capsule Preview</h3>
              </div>
              <button onClick={() => setViewingMessage(null)} className="p-1 text-[#454A46] hover:text-[#1A1A1A] rounded-[10px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              <div className="p-4 rounded-[16px] bg-[#F1EFEC] border border-[#E5E5E1] text-center">
                <Lock className="w-8 h-8 mx-auto text-[#1A1A1A] mb-2" />
                <h4 className="font-serif italic text-lg text-[#1A1A1A]">{viewingMessage.title}</h4>
                <p className="text-[#454A46] text-xs mt-1 font-sans">This message is securely locked. It will trigger automatically to {viewingMessage.recipientName} ({viewingMessage.recipientEmail}) on {viewingMessage.deliveryOption}.</p>
              </div>

              {viewingMessage.mediaUrl && (
                <div className="bg-white p-4 rounded-[16px] border border-[#E5E5E1] flex flex-col items-center">
                  {viewingMessage.type === "voice" && (
                    <div className="w-full py-4 flex flex-col items-center">
                      <Mic className="w-8 h-8 text-[#1A1A1A] mb-2" />
                      <audio src={viewingMessage.mediaUrl} controls className="w-full" />
                    </div>
                  )}
                  {viewingMessage.type === "video" && (
                    <video src={viewingMessage.mediaUrl} controls className="w-full rounded-[16px] max-h-[220px]" />
                  )}
                  <span className="text-[10px] text-[#454A46] mt-2 truncate max-w-xs font-mono">{viewingMessage.mediaName}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-[#1E2521]/50 uppercase tracking-wider">Message Text Content</label>
                <p className="text-xs text-[#1A1A1A]/90 bg-white p-4 border border-[#E5E5E1] leading-relaxed whitespace-pre-line font-serif italic text-justify">
                  &ldquo;{viewingMessage.content}&rdquo;
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-[#E5E5E1] flex justify-end">
              <button
                onClick={() => setViewingMessage(null)}
                className="px-5 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
