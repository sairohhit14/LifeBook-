import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { 
  Video, Sparkles, Loader, Play, Pause, RotateCcw, Volume2, 
  Music, Film, Share2, Download, AlertCircle, Eye, RefreshCw, Layers
} from "lucide-react";

interface GoogleFlowVideoProps {
  guestMode?: boolean;
}

interface VideoScene {
  title: string;
  narration: string;
  visualCue: string;
  duration: number; // in seconds
  mediaUrl?: string;
}

interface VideoScript {
  title: string;
  musicTrack: string;
  durationSeconds: number;
  scenes: VideoScene[];
}

export default function GoogleFlowVideo({ guestMode }: GoogleFlowVideoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [script, setScript] = useState<VideoScript | null>(null);
  
  // Custom video creation options
  const [tonePreset, setTonePreset] = useState<string>("Heartwarming & Reflective");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  // Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0); // 0 to 100 percentage inside current scene
  const [selectedMusicTrack, setSelectedMusicTrack] = useState("Acoustic Melancholy");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Royalty-free background music tracks
  const MUSIC_TRACKS: Record<string, string> = {
    "Acoustic Melancholy": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    "Grand Orchestral Strings": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "Reflective Ambient Piano": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "Cinematic Deep Flow": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "Warm Heritage Folk": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicVolume, setMusicVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Synchronize audio element with isPlaying and selectedMusicTrack
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const currentUrl = MUSIC_TRACKS[selectedMusicTrack] || MUSIC_TRACKS["Acoustic Melancholy"];

    if (audioRef.current.src !== currentUrl) {
      audioRef.current.src = currentUrl;
      audioRef.current.loop = true;
      audioRef.current.load();
    }

    audioRef.current.volume = isMuted ? 0 : musicVolume;

    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.warn("Audio play blocked by browser autoplay policy:", err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, selectedMusicTrack]);

  // Handle volume or mute changes on the fly
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : musicVolume;
    }
  }, [musicVolume, isMuted]);

  // Audio simulation state (for visual equalizer effect)
  const [equalizerBars, setEqualizerBars] = useState<number[]>(new Array(15).fill(20));

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eqIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load a demo or initial script on tab open
  useEffect(() => {
    generateDefaultOrLoad();
    return () => {
      stopPlayback();
    };
  }, []);

  // Equalizer effect simulation
  useEffect(() => {
    if (isPlaying) {
      eqIntervalRef.current = setInterval(() => {
        setEqualizerBars(prev => prev.map(() => Math.floor(Math.random() * 50) + 10));
      }, 150);
    } else {
      if (eqIntervalRef.current) clearInterval(eqIntervalRef.current);
      setEqualizerBars(new Array(15).fill(8));
    }
    return () => {
      if (eqIntervalRef.current) clearInterval(eqIntervalRef.current);
    };
  }, [isPlaying]);

  // Video playback loop
  useEffect(() => {
    if (isPlaying && script && script.scenes.length > 0) {
      const activeScene = script.scenes[currentSceneIndex];
      const sceneDurationMs = (activeScene.duration * 1000) / playbackSpeed;
      const stepTimeMs = 100; // Update progress bar every 100ms
      const increment = (stepTimeMs / sceneDurationMs) * 100;

      timerRef.current = setInterval(() => {
        setSceneProgress(prev => {
          if (prev >= 100) {
            // Move to next scene
            if (currentSceneIndex < script.scenes.length - 1) {
              setCurrentSceneIndex(curr => curr + 1);
              return 0;
            } else {
              // End of video reached
              setIsPlaying(false);
              setCurrentSceneIndex(0);
              return 0;
            }
          }
          return prev + increment;
        });
      }, stepTimeMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentSceneIndex, script, playbackSpeed]);

  const generateDefaultOrLoad = async () => {
    // Generate an initial beautiful mock or load if saved
    setLoading(true);
    try {
      const result = await api.generateVideoScript(tonePreset, customPrompt);
      setScript(result);
      if (result.musicTrack) {
        setSelectedMusicTrack(result.musicTrack);
      }
    } catch (err: any) {
      setError(err.message || "We couldn't start your film. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guestMode) {
      setError("AI Generation is read-only in Family Guest mode.");
      return;
    }
    setLoading(true);
    setError("");
    stopPlayback();

    try {
      // Send optional tone instructions to rewrite the Google Flow script
      const result = await api.generateVideoScript(tonePreset, customPrompt);
      
      // Personalize script with tone
      const tonePrefixes: Record<string, string> = {
        "Heartwarming & Reflective": "A gentle and deeply sentimental reflection. ",
        "Upbeat & Celebratory": "A celebratory and triumphant joy-filled tribute. ",
        "Grand & Majestic": "An epic and magnificent chronological orchestration. ",
        "Minimalist & Peaceful": "A calm, peaceful, and beautifully quiet timeline. "
      };

      // Map tone presets to compatible music tracks to automatically pick fitting "suites"
      const toneToMusic: Record<string, string[]> = {
        "Heartwarming & Reflective": ["Reflective Ambient Piano", "Acoustic Melancholy"],
        "Upbeat & Celebratory": ["Warm Heritage Folk", "Cinematic Deep Flow"],
        "Grand & Majestic": ["Grand Orchestral Strings", "Cinematic Deep Flow"],
        "Minimalist & Peaceful": ["Acoustic Melancholy", "Reflective Ambient Piano"]
      };

      const candidates = toneToMusic[tonePreset] || Object.keys(MUSIC_TRACKS);
      const randomSuiteTrack = candidates[Math.floor(Math.random() * candidates.length)];
      setSelectedMusicTrack(randomSuiteTrack);

      const customizedScript: VideoScript = {
        ...result,
        title: `${tonePreset.split(" ")[0]} Film: ${result.title}`,
        scenes: result.scenes.map((scene, idx) => ({
          ...scene,
          narration: `${tonePrefixes[tonePreset] || ""}${scene.narration} ${customPrompt ? `[Director Note: ${customPrompt}]` : ""}`
        }))
      };

      setScript(customizedScript);
      setCurrentSceneIndex(0);
      setSceneProgress(0);
    } catch (err: any) {
      setError(err.message || "We couldn't create your film right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleShuffleMusic = () => {
    const tracks = Object.keys(MUSIC_TRACKS);
    const currentIdx = tracks.indexOf(selectedMusicTrack);
    let nextIdx = Math.floor(Math.random() * tracks.length);
    if (nextIdx === currentIdx && tracks.length > 1) {
      nextIdx = (nextIdx + 1) % tracks.length;
    }
    const chosen = tracks[nextIdx];
    setSelectedMusicTrack(chosen);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const togglePlay = () => {
    if (!script) return;
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    stopPlayback();
    setCurrentSceneIndex(0);
    setSceneProgress(0);
    setIsPlaying(true);
  };

  // Beautiful visual backdrops when no photo is uploaded for the scene
  const fallbacks = [
    "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?q=80&w=800&auto=format&fit=crop", // Vintage warm light
    "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=800&auto=format&fit=crop", // Golden sunrise
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop", // Ocean horizon
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop", // Mountain peak
  ];

  const getActiveImageUrl = (scene: VideoScene, idx: number) => {
    if (scene.mediaUrl && scene.mediaUrl.trim() !== "") {
      return scene.mediaUrl;
    }
    return fallbacks[idx % fallbacks.length];
  };

  return (
    <div id="google-flow-root" className="space-y-6 animate-fade-in font-sans">
      
      {/* Title Header */}
      <div id="google-flow-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#E5E5E1]">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#C9A66B] text-[#1A1A1A] text-[9px] font-medium uppercase tracking-[0.15em] px-2 py-0.5 rounded-[16px] font-mono">
              Powered by Google Flow AI
            </span>
            <span className="bg-[#315C4A] text-white text-[9px] font-medium uppercase tracking-[0.15em] px-2 py-0.5 rounded-[16px] font-mono animate-pulse">
              Cinema Studio v3.5
            </span>
          </div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] flex items-center gap-2 mt-1.5">
            <Video className="w-7 h-7 text-[#1A1A1A]" />
            <span>Google Flow Legacy Tribute Video</span>
          </h2>
          <p className="text-[#454A46] text-xs">
            Synthesize your chronological memories, logs, photos, and milestones into a seamless, high-fidelity widescreen tribute movie.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cinema Screen Panel & Player Controls (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Cinema Screen */}
          <div 
            id="cinema-canvas" 
            className={`relative bg-black aspect-video overflow-hidden border border-[#315C4A] shadow-2xl flex items-center justify-center group ${
              isFullscreen ? "fixed inset-0 z-50 w-screen h-screen aspect-auto" : "w-full"
            }`}
          >
            {loading ? (
              <div className="text-center text-white space-y-4">
                <Loader className="w-12 h-12 animate-spin text-[#C9A66B] mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-medium uppercase tracking-[0.15em] text-[#C9A66B]">Rendering Widescreen Layers...</p>
                  <p className="text-[10px] text-white/50 font-mono">Analyzing memory logs, cross-referencing timeline files &amp; scripting camera cues</p>
                </div>
              </div>
            ) : script && script.scenes.length > 0 ? (
              <>
                {/* Simulated Ken Burns motion slide layers */}
                {script.scenes.map((scene, idx) => {
                  const isActive = idx === currentSceneIndex;
                  return (
                    <div 
                      key={idx}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      {/* Panoramic Background image with pan-and-zoom animation */}
                      <img 
                        src={getActiveImageUrl(scene, idx)} 
                        alt={scene.title}
                        className={`w-full h-full object-cover select-none transition-transform duration-[10000ms] ease-out ${
                          isActive && isPlaying 
                            ? "scale-110 translate-x-2 translate-y-1" 
                            : "scale-100 translate-x-0 translate-y-0"
                        }`}
                        referrerPolicy="no-referrer"
                      />

                      {/* Dark cinematic vignette overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/60 pointer-events-none"></div>

                      {/* Top left scene indicator */}
                      <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-[9px] text-white font-mono uppercase tracking-widest font-bold">
                        <Film className="w-3.5 h-3.5 text-[#C9A66B]" />
                        <span>Scene {idx + 1} of {script.scenes.length}: {scene.title}</span>
                      </div>

                      {/* Simulated narration subtitles overlay at the bottom */}
                      <div className="absolute bottom-12 left-8 right-8 text-center space-y-3 z-10">
                        <div className="max-w-2xl mx-auto bg-black/50 backdrop-blur-sm p-4 border border-white/10 rounded-[16px]">
                          {/* Animated Voiceover Caption */}
                          <p className="text-white text-sm md:text-base font-serif italic leading-relaxed tracking-wide text-center">
                            &ldquo;{scene.narration}&rdquo;
                          </p>
                        </div>
                        {/* Camera angle & director visual notes indicator */}
                        <span className="text-[9px] uppercase tracking-widest font-bold text-[#C9A66B] block font-mono">
                          🎬 Visual: {scene.visualCue}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Overlaid watermark / screen title */}
                <div className="absolute top-6 right-6 text-right">
                  <h4 className="text-white/80 font-serif italic text-xs tracking-tight">{script.title}</h4>
                  <span className="text-[8px] text-[#C9A66B] font-mono tracking-widest uppercase font-medium">Google Flow Cinema</span>
                </div>

                {/* Audio voiceover waves simulation */}
                {isPlaying && (
                  <div className="absolute right-6 bottom-32 flex items-end gap-0.5 bg-black/40 p-2 border border-white/10 backdrop-blur-sm">
                    {equalizerBars.map((barHeight, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-[#C9A66B] rounded-t-sm transition-all duration-150"
                        style={{ height: `${barHeight}px` }}
                      ></div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-white/70 p-6">
                <Film className="w-10 h-10 text-white/30 mx-auto mb-2" />
                <p className="text-xs">No video sequence compiled yet. Configure preferences on the right to start.</p>
              </div>
            )}
          </div>

          {/* Widescreen Media Player Controls Dashboard */}
          {script && script.scenes.length > 0 && (
            <div id="player-dashboard" className="bg-[#315C4A] text-white p-5 rounded-[16px] space-y-4">
              
              {/* Progress bars & timers */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-white/60 font-bold">
                  <span>Playback Time progress</span>
                  <span className="text-[#C9A66B]">
                    Scene {currentSceneIndex + 1} Progress: {Math.floor(sceneProgress)}%
                  </span>
                </div>
                
                {/* Outer Progress bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-[16px] overflow-hidden relative cursor-pointer">
                  {/* Total overall video progress marker */}
                  <div 
                    className="h-full bg-[#C9A66B] transition-all duration-100 ease-out" 
                    style={{ 
                      width: `${((currentSceneIndex + (sceneProgress / 100)) / script.scenes.length) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* Main controls toolbar */}
              <div className="flex justify-between items-center flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePlay}
                    className="p-3 bg-white hover:bg-[#C9A66B] text-[#1A1A1A] rounded-full transition-all cursor-pointer flex items-center justify-center shadow-lg"
                    title={isPlaying ? "Pause Video" : "Play Video"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current pl-0.5" />}
                  </button>

                  <button 
                    onClick={handleRestart}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer"
                    title="Restart Sequence"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Scene Select buttons */}
                  <div className="hidden sm:flex items-center gap-1.5 bg-white/5 p-1 border border-white/10">
                    {script.scenes.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentSceneIndex(i);
                          setSceneProgress(0);
                        }}
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase font-medium transition-all cursor-pointer ${
                          currentSceneIndex === i 
                            ? "bg-[#C9A66B] text-[#1A1A1A]" 
                            : "text-white/60 hover:bg-white/10"
                        }`}
                      >
                        Scene {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Backing Track selector */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 border border-white/10">
                    <Music className="w-3.5 h-3.5 text-[#C9A66B]" />
                    <select
                      value={selectedMusicTrack}
                      onChange={(e) => setSelectedMusicTrack(e.target.value)}
                      className="bg-transparent text-white text-[10px] uppercase font-medium tracking-wider font-mono border-none focus:outline-none cursor-pointer"
                    >
                      <option value="Acoustic Melancholy" className="bg-[#315C4A]">🎻 Acoustic Melancholy</option>
                      <option value="Grand Orchestral Strings" className="bg-[#315C4A]">🎷 Grand Orchestral Strings</option>
                      <option value="Reflective Ambient Piano" className="bg-[#315C4A]">🎹 Reflective Ambient Piano</option>
                      <option value="Cinematic Deep Flow" className="bg-[#315C4A]">🌌 Cinematic Deep Flow</option>
                      <option value="Warm Heritage Folk" className="bg-[#315C4A]">🌾 Warm Heritage Folk</option>
                    </select>
                  </div>

                  <button
                    onClick={handleShuffleMusic}
                    type="button"
                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[16px] border border-white/10 text-[10px] font-medium font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    title="Pick random music suited for this video"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#C9A66B]" />
                    <span>Shuffle Match</span>
                  </button>
                </div>

                {/* Playback speed multiplier */}
                <div className="flex gap-1">
                  {([1, 1.5, 2] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`w-8 py-1 text-[10px] font-medium font-mono uppercase transition-all rounded-[16px] border cursor-pointer ${
                        playbackSpeed === speed 
                          ? "bg-[#C9A66B] border-[#C9A66B] text-[#1A1A1A]" 
                          : "border-white/20 text-white/70 hover:border-white"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Share & Download Toolbar */}
              <div className="flex justify-between items-center text-xs pt-4 border-t border-white/10 flex-wrap gap-4 text-white/70">
                <div className="flex items-center gap-3 bg-white/5 p-2 border border-white/10">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-[#C9A66B] hover:text-[#C9A66B] focus:outline-none transition-colors"
                    title={isMuted ? "Unmute Music" : "Mute Music"}
                  >
                    <Volume2 className={`w-4 h-4 ${isMuted ? "opacity-40" : ""}`} />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-white/50">Music Volume</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={musicVolume} 
                        onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                        className="w-20 accent-[#C9A66B] h-1 bg-white/20 cursor-pointer" 
                      />
                      <span className="text-[10px] font-mono text-[#C9A66B] w-6">
                        {isMuted ? "0%" : `${Math.round(musicVolume * 100)}%`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const textToSave = JSON.stringify(script, null, 2);
                      const blob = new Blob([textToSave], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${script.title.replace(/\s+/g, "_")}_script.json`;
                      a.click();
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/25 transition-all text-white text-[10px] font-medium uppercase tracking-[0.12em] rounded-[16px] cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Script</span>
                  </button>
                  <button
                    onClick={() => {
                      alert(`Successfully generated secure movie sharing link for ${script.title}! Your descendants will receive an email containing access permissions.`);
                    }}
                    className="px-3 py-1.5 bg-[#C9A66B] hover:bg-[#C9A66B] transition-all text-[#1A1A1A] text-[10px] font-medium uppercase tracking-[0.12em] rounded-[16px] cursor-pointer flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Tribute Film</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Cinema Settings Panel (Right 1 column) */}
        <div className="space-y-6">
          <div className="p-6 rounded-[16px] bg-[#F1EFEC] border border-[#E5E5E1] space-y-6">
            <div className="flex items-center gap-2 text-[#1A1A1A]">
              <Sparkles className="w-5 h-5 text-[#1A1A1A]" />
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">Google Flow Director</h3>
            </div>

            <p className="text-xs text-[#454A46] leading-relaxed font-sans">
              Google Flow aggregates memories, oral testimonies, family connections, and milestone dates from your digital ledger, creating high-impact storytelling sequences tailored to your preferences.
            </p>

            <form onSubmit={handleGenerateVideo} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Cinematic Film Tone</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Heartwarming & Reflective",
                    "Upbeat & Celebratory",
                    "Grand & Majestic",
                    "Minimalist & Peaceful"
                  ].map(tone => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setTonePreset(tone)}
                      className={`p-2.5 text-[10px] font-medium uppercase rounded-[16px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        tonePreset === tone 
                          ? "bg-[#315C4A] border-[#315C4A] text-white" 
                          : "bg-white border-[#E5E5E1] text-[#454A46] hover:border-[#315C4A]"
                      }`}
                    >
                      <span>{tone.split(" & ")[0]}</span>
                      <span className={`text-[8px] font-medium block mt-0.5 ${tonePreset === tone ? "text-[#C9A66B]" : "text-[#8A8F8B]"}`}>{tone.split(" & ")[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Director Custom Instructions</label>
                <textarea
                  rows={4}
                  placeholder="E.g. Focus heavy on the childhood era memories, use poetic language, highlight grandfather's values on kindness."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] leading-relaxed font-serif"
                />
              </div>

              <button
                type="submit"
                disabled={loading || guestMode}
                className="w-full py-3 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-xs font-medium uppercase tracking-[0.15em] flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-55"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin text-[#C9A66B]" />
                    <span>Rendering Widescreen Layers...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-[#C9A66B] animate-spin-slow" />
                    <span>Re-compile Legacy Film</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Interactive Screenplays Index */}
          {script && script.scenes.length > 0 && (
            <div className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] space-y-4">
              <h4 className="font-serif italic text-base font-semibold text-[#1A1A1A]">📜 Film Storyboard Script</h4>
              <div className="space-y-3 divide-y divide-[#E5E5E1] max-h-60 overflow-y-auto pr-1">
                {script.scenes.map((scene, index) => (
                  <div 
                    key={index} 
                    className={`pt-3 first:pt-0 text-xs cursor-pointer transition-colors p-2 ${
                      currentSceneIndex === index ? "bg-[#F7F0E0]/50 border-l-2 border-[#C9A66B]" : "hover:bg-[#F1EFEC]/40"
                    }`}
                    onClick={() => {
                      setCurrentSceneIndex(index);
                      setSceneProgress(0);
                    }}
                  >
                    <div className="flex justify-between font-semibold text-[#1E2521]/60 font-mono text-[9px] uppercase">
                      <span>Scene {index + 1}</span>
                      <span>Duration: {scene.duration}s</span>
                    </div>
                    <h5 className="font-semibold text-[#1E2521] mt-1">{scene.title}</h5>
                    <p className="text-[11px] text-[#1A1A1A]/75 mt-1 font-serif italic line-clamp-2 leading-relaxed">
                      &ldquo;{scene.narration}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
