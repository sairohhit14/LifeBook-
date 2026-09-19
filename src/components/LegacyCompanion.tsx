import React, { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import { api } from "../api";
import { INDIAN_LANGUAGES, findLanguage } from "../languages";
import { 
  MessageSquare, Send, Sparkles, Loader, Trash2, Heart, HelpCircle, 
  ArrowRight, Check, CheckCircle2, AlertCircle, Mic, MicOff, Volume2, Languages
} from "lucide-react";

// Minimal typings for the Web Speech API (not in TS lib by default).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
const getSpeechRecognition = (): SpeechRecognitionCtor | null =>
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;

// Minimal ambient STT support detection (one-shot per module load).
const SPEECH_RECOGNITION_AVAILABLE =
  typeof window !== "undefined" && !!(getSpeechRecognition());

interface LegacyCompanionProps {
  onMemoryAdded: () => void;
  guestMode?: boolean;
}

const CONVERSATION_STARTERS = [
  "Tell me about your first school day",
  "What is your proudest career victory?",
  "How did you meet your partner?",
  "What are three values you want your family to keep?",
  "Tell me about a childhood vacation",
  "What is the biggest lesson life taught you?"
];

export default function LegacyCompanion({ onMemoryAdded, guestMode }: LegacyCompanionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [savingAsMemory, setSavingAsMemory] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ---- language + voice assistant (speak & understand Indian languages)
  const [langCode, setLangCode] = useState<string>(() => localStorage.getItem("lifebook_companion_lang") || "");
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const activeLang = findLanguage(langCode || "en-IN");

  useEffect(() => {
    localStorage.setItem("lifebook_companion_lang", langCode);
  }, [langCode]);

  // Speak a companion message in the selected language.
  const speak = (msg: ChatMessage) => {
    if (!window.speechSynthesis) return;
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.lang = langCode || "en-IN";
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    utteranceRef.current = u;
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(u);
  };

  // Dictate into the input using the selected language.
  const toggleListening = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = langCode || "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const said = Array.from(e.results ?? []).map((r: any) => r[0]?.transcript ?? "").join(" ").trim();
      if (said) setInputText((prev) => (prev ? `${prev} ` : "") + said);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getChatHistory();
      setMessages(data);
    } catch (err: any) {
      setError("We couldn't restore your conversation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || sending) return;
    
    setError("");
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setSending(true);

    try {
      // Server instructs Gemini to answer in the selected language.
      const companionMsg = await api.sendMessage(textToSend, langCode || undefined);
      setMessages(prev => [...prev, companionMsg]);
      if (langCode) speak(companionMsg); // voice assistant: read the reply aloud
    } catch (err: any) {
      setError(err.message || "We couldn't send that message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Do you want to permanently clear this conversation?")) return;
    try {
      const history = await api.clearChatHistory();
      setMessages(history);
    } catch (err: any) {
      setError("We couldn't clear the conversation. Please try again.");
    }
  };

  const handleSaveAsMemory = async () => {
    if (messages.length < 2) return;
    setSavingAsMemory(true);
    try {
      // Build memory title & description from transcript
      const transcript = messages
        .map(m => `${m.sender === "user" ? "Reflections" : "Companion"}: ${m.text}`)
        .join("\n\n");

      const title = `AI Interview: Reflections from ${new Date().toLocaleDateString("en-US")}`;
      await api.createMemory({
        title,
        description: `This transcript was captured from a conversational session with my AI Companion:\n\n${transcript}`,
        date: new Date().toISOString().split("T")[0],
        tags: ["interview", "companion", "reflections"],
        media: []
      });

      setSaveSuccess(true);
      onMemoryAdded();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError("Could not transform conversation: " + err.message);
    } finally {
      setSavingAsMemory(false);
    }
  };

  return (
    <div id="companion-root" className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in font-sans h-[78vh] items-stretch">
      {/* Suggested Starters Panel (1 column) */}
      <div className="p-6 rounded-[16px] bg-white border border-[#E5E5E1] space-y-5 h-fit lg:h-full flex flex-col justify-between shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#1A1A1A]">
            <Sparkles className="w-5 h-5 text-[#1A1A1A] animate-pulse" />
            <h3 className="font-serif italic text-lg text-[#1A1A1A]">Life Companion Coach</h3>
          </div>

          <p className="text-xs text-[#454A46] leading-relaxed">
            Struggling to remember what stories to write? Tap any starter question below. Your companion will guide you through capturing rich details.
          </p>

          <div className="space-y-2.5">
            {CONVERSATION_STARTERS.map((starter, idx) => (
              <button
                key={idx}
                onClick={() => !guestMode && handleSendMessage(starter)}
                className="w-full text-left p-3 bg-[#F1EFEC] hover:bg-[#E5E5E1] border border-[#E5E5E1] text-xs font-serif italic rounded-[16px] text-[#1A1A1A] transition-all flex items-center justify-between cursor-pointer group"
               
              >
                <span className="max-w-[85%] truncate">&ldquo;{starter}&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#1A1A1A] transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Sync Controls */}
        {!guestMode && messages.length >= 2 && (
          <div className="pt-4 border-t border-[#E5E5E1] space-y-2.5">
            <button
              onClick={handleSaveAsMemory}
              disabled={savingAsMemory}
              className="w-full py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {savingAsMemory ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Chat to Memory Vault</span>
                </>
              )}
            </button>
            {saveSuccess && (
              <p className="text-[10px] text-[#3D5F4C] text-center font-bold">✓ Converted successfully! Check Memory Vault.</p>
            )}
          </div>
        )}
      </div>

      {/* Interactive Chat Window (2 columns) */}
      <div className="lg:col-span-2 rounded-[16px] bg-white border border-[#E5E5E1] flex flex-col h-full overflow-hidden shadow-sm">
        {/* Chat Header */}
        <div className="p-4 bg-[#F1EFEC] border-b border-[#E5E5E1] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full animate-breathe" style={{ background: "radial-gradient(circle at 30% 30%, var(--color-brand-sage), var(--color-brand-primary))", boxShadow: "0 0 10px rgba(126,155,137,0.55)" }} aria-hidden="true"></div>
            <div>
              <h4 className="font-serif italic text-sm text-[#1A1A1A]">Empathetic Legacy Assistant</h4>
              <p className="text-[10px] text-[#454A46] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#315C4A] inline-block"></span>
                Gemini 3.6 Flash Active • Memory Vault Connected
              </p>
            </div>
          </div>

          {/* Conversation language: companion speaks & understands it */}
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-[#8A8F8B]" aria-hidden="true" />
            <select
              value={langCode}
              onChange={(e) => { setLangCode(e.target.value); window.speechSynthesis?.cancel(); setSpeakingId(null); }}
              aria-label="Conversation language"
              className="px-2 py-1.5 bg-white border border-[#E5E5E1] rounded-[10px] text-[10px] text-[#1A1A1A] focus:outline-none focus:border-[#315C4A] cursor-pointer"
            >
              <option value="">Auto (mirror user)</option>
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native === l.label ? l.label : `${l.native} · ${l.label}`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearHistory}
            className="p-1.5 hover:bg-[#F9EFEB] border border-transparent hover:border-[#E8CDC4] rounded-[16px] text-[#8A8F8B] hover:text-[#B4543E] transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Ledger Display Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#F9F7F2]/30">
          {error && (
            <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#454A46] gap-2">
              <Loader className="w-6 h-6 animate-spin text-[#1A1A1A]" />
              <span className="text-xs font-mono uppercase tracking-wider">Restoring assistant conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="mx-auto w-12 h-12 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex items-center justify-center text-[#454A46]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="font-serif italic text-lg text-[#1A1A1A]">Start your dialogue</h4>
              <p className="text-[#454A46] text-xs max-w-sm mx-auto leading-relaxed font-sans">
                Send a question or simple greeting to your AI life coach to trigger conversation and reflections.
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isUser = msg.sender === "user" || msg.role === "user";
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 max-w-xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  {/* Avatar Icon */}
                  <div className={`w-8 h-8 rounded-[16px] flex items-center justify-center text-[10px] font-bold font-mono uppercase flex-shrink-0 ${
                    isUser ? "bg-[#315C4A] text-white" : "bg-white text-[#1A1A1A] border border-[#E5E5E1]"
                  }`}>
                    {isUser ? "Me" : "AI"}
                  </div>

                  <div className={`p-4 rounded-[16px] text-xs leading-relaxed ${
                    isUser 
                      ? "bg-[#315C4A] text-white font-sans" 
                      : "bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] font-serif italic text-justify whitespace-pre-wrap"
                  }`}>
                    <p>{msg.text}</p>
                    {!isUser && ("speechSynthesis" in window) && (
                      <button
                        onClick={() => speak(msg)}
                        aria-pressed={speakingId === msg.id}
                        aria-label={speakingId === msg.id ? "Stop reading aloud" : "Read aloud"}
                        className="mt-2 text-[#8A8F8B] hover:text-[#315C4A] transition-colors cursor-pointer"
                      >
                        {speakingId === msg.id ? <MicOff className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-[16px] bg-white text-[#1A1A1A] border border-[#E5E5E1] flex items-center justify-center text-[10px] font-bold font-mono">
                AI
              </div>
              <div className="p-4 rounded-[16px] bg-[#F1EFEC] border border-[#E5E5E1] flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-[#1A1A1A]" />
                <span className="text-xs text-[#454A46] font-mono uppercase tracking-wider">Formulating reflecting queries...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Field */}
        <div className="p-4 bg-[#F1EFEC] border-t border-[#E5E5E1] flex-shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }} 
            className="flex gap-2"
          >
            <input
              type="text"
              disabled={sending || guestMode}
              placeholder={
                listening
                  ? "Listening..."
                  : guestMode
                    ? "Chat inputs disabled in Family Guest mode"
                    : activeLang && langCode
                      ? `Tell your coach in ${activeLang.native}...`
                      : "Tell your coach about a defining childhood memory..."
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
            />
            {SPEECH_RECOGNITION_AVAILABLE && !guestMode && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={sending}
                aria-pressed={listening}
                aria-label={listening ? "Stop dictation" : "Speak your memory"}
                className={`p-3 rounded-[16px] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center border ${
                  listening
                    ? "bg-[#B4543E] hover:bg-[#9E4132] border-[#E8CDC4] text-white animate-pulse"
                    : "bg-white hover:bg-[#F1EFEC] border-[#E5E5E1] text-[#315C4A]"
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={sending || !inputText.trim() || guestMode}
              className="p-3 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
