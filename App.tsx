
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, User, Terminal, Power, Sparkles, Wifi, Settings2, Video, Ratio, Clock, Film, Lightbulb, X, Play, CheckCircle2, AlertTriangle, Share2, Download, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { ImageList, CircularProgress, StatusIcon, getStatusColor } from './components/VideoList';
import { AudioVisualizer } from './components/AudioVisualizer';
import { UserProfile } from './components/UserProfile';
import { ParticleBackground } from './components/ParticleBackground';
import { base64ToBytes, createPcmBlob, decodeAudioData } from './services/audioUtils';
import { createVideoTask, checkVideoStatus } from './services/kieService';
import { initSupabase, saveProject, getProjects } from './services/supabaseService';
import { tools } from './services/toolDefinitions';
import { GeneratedImage, LogMessage } from './types';
import { CONFIG } from './config';
import { playHoverSound, playClickSound, playLogoSound, playStartSound } from './services/soundEffects';

const SYSTEM_INSTRUCTION = `
You are Aim8, an Autonomous Intelligent Image Mate.
Your purpose is to create high-quality images using advanced AI models via Kie.ai.

CAPABILITIES:
- You can generate images using these models:
  1. Nano Banana (Default for fast/standard) - model slug: 'nano-banana'
  2. Grok - Good for logical/text-heavy or meme images.
  3. Imagen - High fidelity photorealism.

RULES:
1. You have access to tools 'create_image_task' and 'check_video_status'.
   (Note: Even though the tool might be named video_status, we use it for images too).
2. Authentication is handled by the system. DO NOT ask the user for an API key.
3. When a user asks for an image:
   - Clarify details if vague (aspect ratio).
   - If the user specifies a model (e.g., "use Grok"), pass it to the tool. Otherwise, default to Nano Banana.
   - Call 'create_image_task' immediately.
   - Inform the user you have started the task.
   - **IMPORTANT: DO NOT read out the Task ID or alphanumeric codes. Just confirm the generation has started.**
4. If a user asks for status, use 'check_video_status' with the relevant task ID.

Identity: You are Aim8, the Image Mate.
`;

// Default Settings Type
interface StudioSettings {
  model: string;
  aspectRatio: 'landscape' | 'portrait' | 'square';
  resolution: '1024x1024';
}

const PROMPTS = [
  '"Generate a cyberpunk city with Grok..."',
  '"Create a cinematic shot of a forest using Imagen..."',
  '"Make a portrait of a futuristic robot..."',
  '"Visualize a golden dreamscape..."',
  '"Show me a cat playing piano in 4k..."'
];

const App: React.FC = () => {
  // Config State
  const [showProfile, setShowProfile] = useState(false);

  // Live Session State
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model speaking
  const [isMicOn, setIsMicOn] = useState(true);
  const [activeMode, setActiveMode] = useState<'live' | 'studio'>('live');
  
  // Studio Settings State
  const [studioSettings, setStudioSettings] = useState<StudioSettings>({
    model: 'nano-banana',
    aspectRatio: 'square',
    resolution: '1024x1024'
  });

  // Prompt Rotation
  const [promptIdx, setPromptIdx] = useState(0);

  useEffect(() => {
    if (isConnected) return;
    const i = setInterval(() => setPromptIdx(p => (p + 1) % PROMPTS.length), 4000);
    return () => clearInterval(i);
  }, [isConnected]);

  // Ref for settings to access inside callbacks without stale closures
  const studioSettingsRef = useRef<StudioSettings>(studioSettings);

  // Update ref when state changes
  useEffect(() => {
    studioSettingsRef.current = studioSettings;
  }, [studioSettings]);

  // Data State
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  
  // The ID of the image currently shown on the phone screen overlay
  const [viewingImageId, setViewingImageId] = useState<string | null>(null);

  // Derived active image object
  const viewingImage = images.find(v => v.id === viewingImageId);

  // Refs for Audio/Session
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null); // Holds the active Live session
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const addLog = (text: string, source: 'user' | 'aim8' | 'system') => {
    setLogs(prev => [...prev, { id: Date.now().toString(), text, source, timestamp: Date.now() }]);
  };

  // Initialization
  useEffect(() => {
    // Initialize Supabase
    const sb = initSupabase(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    if (sb) {
      addLog("Supabase Connection Established.", "system");
      // Fetch History
      getProjects().then(projects => {
        if (projects.length > 0) {
          setImages(projects);
          addLog(`Loaded ${projects.length} projects from history.`, "system");
        }
      });
    } else {
      addLog("Supabase not configured. History will be local only.", "system");
    }

    // Check Gemini Key
    if (!CONFIG.GEMINI_API_KEY) {
      addLog("WARNING: Gemini API Key not found in environment.", "system");
    }
  }, []);

  // --- Disconnect & Cleanup Helper ---
  const disconnect = useCallback(async () => {
    // Stop Media Stream Tracks (Mic)
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    // Disconnect Script Processor
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    // Close Input Context
    if (inputContextRef.current) {
        try {
            await inputContextRef.current.close();
        } catch (e) { console.warn("Input context close error", e); }
        inputContextRef.current = null;
    }
    // Close Output Context
    if (audioContextRef.current) {
        try {
            await audioContextRef.current.close();
        } catch (e) { console.warn("Audio context close error", e); }
        audioContextRef.current = null;
    }
    
    setIsConnected(false);
    setIsSpeaking(false);
    sessionRef.current = null;
  }, []);

  // --- Video Polling Logic (Reused for Images) ---
  const pollImageStatus = useCallback(async (taskId: string, prompt: string) => {
    // Initial log
    addLog(`Started monitoring task ${taskId}`, 'system');
    const startTime = Date.now();
    const EXPECTED_DURATION_MS = 15000; // Images are faster ~15s
    
    const pollInterval = setInterval(async () => {
      const status = await checkVideoStatus(CONFIG.KIE_API_KEY, taskId);
      
      if (status.status === 'success' && status.videoUrl) {
        // Update Local State
        const updatedImage: GeneratedImage = { 
           id: taskId, 
           prompt, 
           status: 'completed', 
           url: status.videoUrl, // URL from API
           timestamp: Date.now(),
           progress: 100,
           detailedStatus: 'Completed'
        };
        
        setImages(prev => prev.map(v => v.id === taskId ? { ...v, ...updatedImage } : v));
        addLog(`Image generated successfully for task ${taskId}`, 'system');
        
        // Save to Supabase
        await saveProject(updatedImage);

        clearInterval(pollInterval);
      } else if (status.status === 'failed' || status.status === 'error') {
        const failedImage: GeneratedImage = { 
          id: taskId, 
          prompt, 
          status: 'failed',
          timestamp: Date.now(),
          detailedStatus: 'Failed',
          progress: 0
        };

        setImages(prev => prev.map(v => v.id === taskId ? { ...v, ...failedImage } : v));
        addLog(`Image generation failed for task ${taskId}: ${status.error}`, 'system');
        
        // Save failure state
        await saveProject(failedImage);
        
        clearInterval(pollInterval);
      } else {
        // Still waiting/processing
        // Calculate simulated progress
        const elapsed = Date.now() - startTime;
        const simulatedProgress = Math.min(99, Math.floor((elapsed / EXPECTED_DURATION_MS) * 100));
        
        const finalProgress = (status.progress && status.progress > simulatedProgress) 
            ? status.progress 
            : simulatedProgress;

        setImages(prev => prev.map(v => v.id === taskId ? {
            ...v,
            status: 'generating',
            progress: finalProgress,
            detailedStatus: status.detailedStatus || v.detailedStatus || 'Processing'
        } : v));
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 2 minutes
    setTimeout(() => {
        clearInterval(pollInterval);
    }, 120000);
  }, []);

  // --- Live API Connection ---
  const connectToLive = async () => {
    if (!CONFIG.GEMINI_API_KEY) {
      alert("Gemini API Key missing. Please check your environment.");
      return;
    }

    playClickSound(); // Feedback

    try {
      addLog("Initializing neural link...", "system");
      const ai = new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
      
      // Audio Setup
      const AudioContextPolyfill = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextPolyfill({ sampleRate: 16000 });
      audioContextRef.current = new AudioContextPolyfill({ sampleRate: 24000 });
      
      // Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use gemini-2.0-flash-exp for better stability
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: tools,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            addLog("Ai Image m8 Online.", "system");
            playStartSound();
            
            // Start Input Stream
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!isMicOn) return; 
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             // Handle Transcription
             if (msg.serverContent?.inputTranscription?.text) {
               addLog(msg.serverContent.inputTranscription.text, 'user');
             }

             // Handle Tool Calls
             if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    addLog(`Executing: ${fc.name}`, 'system');
                    
                    let result = {};
                    if (fc.name === 'create_image_task') {
                        playStartSound(); // Sound effect for task start
                        const args = fc.args as any;
                        
                        if (!CONFIG.KIE_API_KEY || CONFIG.KIE_API_KEY.includes('YOUR_KIE')) {
                             result = { success: false, error: "System Error: Kie.ai API Key not configured in background." };
                             addLog("Error: Kie.ai API Key missing in config.ts", 'system');
                        } else {
                            // Apply defaults from Studio Settings if not provided by voice
                            const currentSettings = studioSettingsRef.current;
                            const finalModel = args.model || currentSettings.model;
                            const finalAspectRatio = args.aspect_ratio || currentSettings.aspectRatio;

                            addLog(`Generating image with model: ${finalModel} (${finalAspectRatio})`, 'system');
                            
                            const response = await createVideoTask({
                                apiKey: CONFIG.KIE_API_KEY,
                                prompt: args.prompt,
                                model: finalModel,
                                aspect_ratio: finalAspectRatio,
                                remove_watermark: args.remove_watermark
                            });

                            if (response.success && response.taskId) {
                                // Instruction to AI embedded in tool response
                                result = { 
                                  success: true, 
                                  taskId: response.taskId, 
                                  message: "Task started successfully. Tell the user it is processing. DO NOT READ THE TASK ID." 
                                };
                                
                                // Update UI
                                const newImage: GeneratedImage = {
                                    id: response.taskId,
                                    prompt: args.prompt,
                                    model: finalModel,
                                    status: 'generating',
                                    timestamp: Date.now(),
                                    progress: 0,
                                    detailedStatus: 'Initialized'
                                };
                                setImages(prev => [newImage, ...prev]);
                                
                                // Auto-open the phone overlay
                                setViewingImageId(response.taskId);
                                
                                // Start background polling
                                pollImageStatus(response.taskId, args.prompt);
                                
                                // Initial Save (Generating State)
                                await saveProject(newImage);
                            } else {
                                result = { success: false, error: response.error };
                            }
                        }
                    } else if (fc.name === 'check_video_status') {
                        const args = fc.args as any;
                         if (!CONFIG.KIE_API_KEY) {
                             result = { success: false, error: "API Key missing" };
                         } else {
                            const response = await checkVideoStatus(CONFIG.KIE_API_KEY, args.task_id);
                            result = response;
                         }
                    }

                    // Send response back
                    sessionPromise.then(session => {
                        session.sendToolResponse({
                            functionResponses: {
                                id: fc.id,
                                name: fc.name,
                                response: { result }
                            }
                        });
                    });
                }
             }

             // Handle Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
             if (audioData && audioContextRef.current) {
                 setIsSpeaking(true);
                 const ctx = audioContextRef.current;
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 try {
                     const buffer = await decodeAudioData(
                         base64ToBytes(audioData),
                         ctx,
                         24000,
                         1
                     );
                     const source = ctx.createBufferSource();
                     source.buffer = buffer;
                     source.connect(ctx.destination);
                     source.addEventListener('ended', () => {
                         sourcesRef.current.delete(source);
                         if (sourcesRef.current.size === 0) setIsSpeaking(false);
                     });
                     source.start(nextStartTimeRef.current);
                     nextStartTimeRef.current += buffer.duration;
                     sourcesRef.current.add(source);
                 } catch (e) {
                     console.error("Audio decode error", e);
                 }
             }

             // Handle Interruption
             if (msg.serverContent?.interrupted) {
                 addLog("Interrupted.", "system");
                 sourcesRef.current.forEach(s => s.stop());
                 sourcesRef.current.clear();
                 setIsSpeaking(false);
                 nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
            setIsConnected(false);
            setIsSpeaking(false);
            addLog("Connection closed.", "system");
          },
          onerror: (err) => {
            console.error(err);
            addLog("Connection Error: Service Unavailable or Invalid Key.", "system");
            setIsConnected(false);
          }
        }
      });

      // Handle initial connection failures (e.g. Deadline Exceeded)
      sessionPromise.catch(async (err) => {
          console.error("Live Session Connection Failed:", err);
          addLog(`Connection Failed: ${err.message || 'Timeout/Network Error'}`, 'system');
          await disconnect();
      });
      
      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to connect", error);
      addLog("Failed to connect: " + (error as Error).message, "system");
      await disconnect();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#1f1a0b] text-aim-gold font-sans selection:bg-aim-gold selection:text-black overflow-x-hidden relative flex flex-col">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Header */}
      <header className="absolute top-6 left-8 z-50 flex items-center justify-between w-[calc(100%-4rem)]">
        <div 
          className="flex flex-col cursor-pointer group"
          onMouseEnter={playLogoSound}
        >
           {/* Logo with Hover Sound */}
           <h1 className="font-display font-bold text-3xl tracking-tight text-aim-gold group-hover:text-white transition-colors duration-300">Aim8</h1>
           <span className="text-xs text-amber-500/80 font-mono tracking-wider uppercase group-hover:text-amber-300 transition-colors">Autonomous Intelligent Image Mate</span>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => { playClickSound(); setShowProfile(true); }}
            onMouseEnter={playHoverSound}
            className="p-3 bg-amber-900/20 hover:bg-amber-500/20 backdrop-blur-md border border-amber-500/30 rounded-full transition-all text-aim-gold hover:scale-105 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            title="User Profile"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* User Profile Side Panel */}
      <UserProfile 
        isOpen={showProfile} 
        onClose={() => { playClickSound(); setShowProfile(false); }} 
        projects={images} 
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-28 relative z-10 pb-20 px-4">
        
        {/* Phone Container */}
        <div className="relative w-[449px] h-[956px] bg-[#0f0d05] rounded-[45px] border-[6px] border-aim-gold shadow-[0_0_60px_rgba(234,179,8,0.3)] flex flex-col overflow-hidden ring-1 ring-amber-300/20 transition-colors">
           
           {/* Screen Glow */}
           <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

           {/* Dynamic Island / Notch Area */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50 flex items-center justify-center border-b border-l border-r border-gray-800">
             <div className="w-16 h-1 bg-[#2a2a2a] rounded-full"></div>
           </div>

           {/* Status Bar (Fake) */}
           <div className="flex justify-between px-6 pt-3 pb-2 text-[10px] text-amber-700/80 font-medium z-40">
             <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             <div className="flex items-center gap-1">
               <Wifi className="w-3 h-3" />
               <span>5G</span>
             </div>
           </div>

           {/* Mode Toggle (Hidden if viewing an image) */}
           {!viewingImageId && (
             <div className="px-6 pt-4 z-40">
               <div 
                 className="flex bg-amber-950/30 rounded-full p-1 backdrop-blur-md border border-amber-500/20 relative"
                 onMouseEnter={playHoverSound}
               >
                 {/* Slider */}
                 <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-aim-gold rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(234,179,8,0.4)] ${activeMode === 'live' ? 'left-1' : 'left-[50%]'}`} />
                 
                 <button 
                   onClick={() => { playClickSound(); setActiveMode('live'); }}
                   className={`flex-1 py-2 text-xs font-bold text-center relative z-10 transition-colors flex items-center justify-center gap-1 ${activeMode === 'live' ? 'text-black' : 'text-amber-600'}`}
                 >
                   <Sparkles className="w-3 h-3" /> Ai Image m8
                 </button>
                 <button 
                   onClick={() => { playClickSound(); setActiveMode('studio'); }}
                   className={`flex-1 py-2 text-xs font-bold text-center relative z-10 transition-colors flex items-center justify-center gap-1 ${activeMode === 'studio' ? 'text-black' : 'text-amber-600'}`}
                 >
                   <Settings2 className="w-3 h-3" /> Image Studio
                 </button>
               </div>
             </div>
           )}

           {/* Screen Content */}
           <div className="flex-1 flex flex-col relative z-30 px-6 overflow-hidden">
             
             {/* IMAGE OVERLAY MODE */}
             {viewingImageId && viewingImage ? (
               <div className="absolute inset-0 bg-black z-50 flex flex-col animate-[slideIn_0.3s_ease-out]">
                 {/* Close Button */}
                 <div className="absolute top-14 right-6 z-[60]">
                    <button 
                      onClick={() => { playClickSound(); setViewingImageId(null); }}
                      onMouseEnter={playHoverSound}
                      className="p-2 bg-black/50 text-white/70 hover:text-aim-gold hover:bg-black/80 rounded-full backdrop-blur-md border border-white/10 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                 </div>

                 {/* Main Content Area */}
                 <div className="flex-1 flex items-center justify-center relative w-full h-full">
                    {viewingImage.status === 'completed' && viewingImage.url ? (
                      <div className="w-full h-full flex items-center justify-center bg-black relative group">
                         <img 
                           src={viewingImage.url} 
                           alt={viewingImage.prompt}
                           className="w-full h-full object-contain"
                         />
                         
                         {/* Action Bar - Always visible for clear UX */}
                         <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 p-4 z-50">
                            <a 
                              href={viewingImage.url} 
                              download={`aim8-${viewingImage.id}.png`}
                              onMouseEnter={playHoverSound}
                              onClick={playClickSound}
                              className="flex items-center gap-2 px-5 py-3 bg-black/60 backdrop-blur-md rounded-full border border-aim-gold/30 text-aim-gold hover:bg-aim-gold hover:text-black transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] group"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Save</span>
                            </a>

                            <button 
                              onClick={() => { playClickSound(); setViewingImageId(null); }}
                              onMouseEnter={playHoverSound}
                              className="flex items-center gap-2 px-5 py-3 bg-aim-gold text-black rounded-full border border-aim-gold shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:bg-white hover:border-white transition-all"
                            >
                              <RefreshCw className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Create New</span>
                            </button>
                         </div>
                      </div>
                    ) : viewingImage.status === 'failed' ? (
                      <div className="text-center p-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500 border border-red-500/30">
                          <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Generation Failed</h3>
                        <p className="text-sm text-gray-400">{viewingImage.detailedStatus || "Unknown Error"}</p>
                        <button 
                           onClick={() => { playClickSound(); setViewingImageId(null); }}
                           className="mt-4 px-6 py-2 bg-aim-gold/10 text-aim-gold border border-aim-gold/30 rounded-full text-xs uppercase font-bold hover:bg-aim-gold hover:text-black transition-all"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      /* Generating State */
                      <div className="flex flex-col items-center justify-center space-y-6">
                         <div className="scale-150">
                            <CircularProgress 
                              progress={viewingImage.progress || 0} 
                              status={viewingImage.detailedStatus || 'Processing'} 
                            />
                         </div>
                         <div className="text-center space-y-2">
                           <div className={`flex items-center justify-center gap-2 ${getStatusColor(viewingImage.detailedStatus || 'Processing')} font-bold tracking-widest uppercase text-sm animate-pulse`}>
                             <StatusIcon status={viewingImage.detailedStatus || 'Processing'} className="w-4 h-4" />
                             <span>{viewingImage.detailedStatus || 'PROCESSING'}</span>
                           </div>
                           <p className="text-xs text-amber-500/60 font-mono max-w-[200px] mx-auto line-clamp-2">
                             "{viewingImage.prompt}"
                           </p>
                           <div className="pt-4 text-[10px] text-amber-700 font-mono border-t border-amber-500/10 mt-4 w-32 mx-auto">
                             EST. REMAINING: <span className="text-aim-gold">~15s</span>
                           </div>
                         </div>
                      </div>
                    )}
                 </div>
               </div>
             ) : (
               /* STANDARD MODES (Live / Studio) */
               activeMode === 'live' ? (
                 <>
                   {/* Main Visual */}
                   <div className="flex-1 flex flex-col items-center justify-center w-full pb-10">
                     <div className="mb-8 text-center space-y-1">
                       <h2 className="text-3xl font-display font-bold text-aim-gold tracking-tight drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">Ai Image m8</h2>
                       <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-900/20 border border-amber-500/30">
                         <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-700'}`}></div>
                         <span className="text-[10px] uppercase tracking-wider font-mono text-amber-500">
                           {isConnected ? 'Connected' : 'Realtime Ready'}
                         </span>
                       </div>
                     </div>

                     <AudioVisualizer isActive={isConnected} isSpeaking={isSpeaking} />
                     
                     {/* Rotating Prompts Area (Visible only when OFFLINE) */}
                     <div className="mt-12 h-6 flex items-center justify-center w-full">
                       {!isConnected && (
                          <p key={promptIdx} className="text-center text-sm text-amber-200/60 px-4 leading-relaxed animate-[slideIn_0.5s_ease-out]">
                            {PROMPTS[promptIdx]}
                          </p>
                       )}
                     </div>
                   </div>

                   {/* Controls - Moved higher up */}
                   <div className="w-full pb-32 flex justify-center">
                     {!isConnected ? (
                       <button 
                         onClick={connectToLive}
                         onMouseEnter={playHoverSound}
                         className="relative w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)] transition-all duration-300 group active:scale-95 hover:shadow-[0_0_60px_rgba(234,179,8,0.6)]"
                       >
                         {/* Pulsing Ring Animation */}
                         <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                         <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_500ms]" />
                         
                         <Mic className="w-8 h-8 text-black group-hover:text-amber-600 transition-colors relative z-10" />
                       </button>
                     ) : (
                       <div className="flex items-center gap-6">
                          <button 
                            onClick={() => { playClickSound(); setIsMicOn(!isMicOn); }}
                            onMouseEnter={playHoverSound}
                            className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 ${
                              isMicOn ? 'bg-amber-500/20 border-amber-400/30 text-aim-gold hover:bg-amber-500/30' : 'bg-red-500/20 border-red-500 text-red-500'
                            }`}
                          >
                            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                          </button>
                          
                          <button 
                            onClick={() => { playClickSound(); disconnect(); }}
                            onMouseEnter={playHoverSound}
                            className="w-14 h-14 rounded-full bg-red-500/80 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-600 transition-all duration-300"
                          >
                            <Power className="w-6 h-6" />
                          </button>
                       </div>
                     )}
                   </div>
                   
                   {!isConnected && (
                      <div className="absolute bottom-12 w-full text-center text-[10px] text-aim-gold font-mono tracking-widest uppercase animate-pulse">
                         Tap to connect
                      </div>
                   )}
                 </>
               ) : (
                 /* IMAGE STUDIO MODE */
                 <div className="flex-1 flex flex-col py-6 overflow-y-auto scrollbar-hide">
                   <div className="space-y-6">
                     
                     {/* Section: Presets */}
                     <div className="space-y-3">
                       <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider px-1 flex items-center gap-2">
                         <Settings2 className="w-3 h-3" /> Default Configuration
                       </h3>
                       
                       {/* Model Select */}
                       <div className="bg-amber-950/30 rounded-xl p-1 flex gap-1 border border-amber-500/20">
                         {['nano-banana', 'grok', 'imagen'].map(model => (
                           <button 
                             key={model}
                             onClick={() => { playClickSound(); setStudioSettings(prev => ({...prev, model})); }}
                             onMouseEnter={playHoverSound}
                             className={`flex-1 py-2 text-[10px] font-bold rounded-lg uppercase transition-all ${studioSettings.model === model ? 'bg-aim-gold text-black shadow-lg' : 'text-amber-600 hover:text-amber-200 hover:bg-white/5'}`}
                           >
                             {model.replace('-banana', '')}
                           </button>
                         ))}
                       </div>

                       {/* Ratio Grid */}
                       <div className="bg-amber-950/30 rounded-xl border border-amber-500/20 overflow-hidden">
                           <div className="bg-black/20 p-2 border-b border-amber-500/10 flex items-center gap-2">
                             <Ratio className="w-3 h-3 text-aim-gold" />
                             <span className="text-[10px] font-bold text-amber-300 uppercase">Aspect Ratio</span>
                           </div>
                           <div className="flex p-1 gap-1">
                              {['square', 'landscape', 'portrait'].map(ratio => (
                                <button 
                                  key={ratio}
                                  onClick={() => { playClickSound(); setStudioSettings(prev => ({...prev, aspectRatio: ratio as any})); }}
                                  onMouseEnter={playHoverSound}
                                  className={`flex-1 py-2 text-[10px] font-medium rounded transition-all ${studioSettings.aspectRatio === ratio ? 'bg-aim-gold/20 text-aim-gold border border-aim-gold/30' : 'text-amber-700 hover:text-amber-300'}`}
                                >
                                  {ratio === 'square' ? '1:1' : ratio === 'landscape' ? '16:9' : '9:16'}
                                </button>
                              ))}
                           </div>
                         </div>
                     </div>

                     {/* Section: Tips */}
                     <div className="space-y-3">
                        <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider px-1 flex items-center gap-2">
                           <Lightbulb className="w-3 h-3" /> Pro Prompt Tips
                        </h3>
                        <div className="space-y-2">
                          <div className="bg-amber-950/20 border border-amber-500/10 rounded-lg p-3 text-[10px] text-amber-200/70 leading-relaxed hover:border-aim-gold/30 transition-colors">
                            <strong className="text-aim-gold block mb-1">Lighting</strong>
                            "Volumetric lighting", "Cyberpunk neon", "Golden hour sun", "Soft studio light"
                          </div>
                          <div className="bg-amber-950/20 border border-amber-500/10 rounded-lg p-3 text-[10px] text-amber-200/70 leading-relaxed hover:border-aim-gold/30 transition-colors">
                            <strong className="text-aim-gold block mb-1">Style & Texture</strong>
                            "Oil painting", "Unreal Engine 5 render", "Matte painting", "Polaroid vintage"
                          </div>
                        </div>
                     </div>

                     <div className="text-center pb-4">
                       <p className="text-[9px] text-amber-800 italic">
                         Settings are applied automatically to vague voice commands.
                       </p>
                     </div>

                   </div>
                 </div>
               )
             )}
           </div>
        </div>

        {/* Content Feed (Below Phone) */}
        <div className="w-full max-w-3xl mt-16 px-6">
           <div className="flex items-center justify-between mb-6 border-b border-amber-500/20 pb-4">
              <h3 className="font-display text-xl font-bold text-aim-gold">Generated Feed</h3>
              <div className="flex gap-2 text-xs font-mono text-amber-700">
                 <span>{images.length} ITEMS</span>
                 <span>•</span>
                 <span>{logs.length} LOGS</span>
              </div>
           </div>

           <ImageList images={images} onSelect={(id) => { playClickSound(); setViewingImageId(id); }} />
           
           {/* Mini Logs */}
           {logs.length > 0 && (
             <div className="mt-12 bg-black/40 border border-amber-500/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-amber-600 mb-3 text-xs font-mono uppercase tracking-wider">
                   <Terminal className="w-3 h-3" />
                   Last Activity
                </div>
                <div className="font-mono text-xs text-amber-500/60 space-y-1.5">
                   {logs.slice(-3).reverse().map((log) => (
                     <div key={log.id} className="flex gap-3">
                       <span className="text-amber-800 opacity-50">[{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                       <span className={log.source === 'system' ? 'text-aim-gold' : 'text-amber-200/80'}>
                         {log.text}
                       </span>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>

      </main>
    </div>
  );
};

export default App;
