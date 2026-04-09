
import React from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, isSpeaking }) => {
  return (
    <div className="relative flex items-center justify-center w-64 h-64 my-4">
      
      {/* 1. Ambient Background Glow (Large Bloom) */}
      <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-1000 ${
        isActive 
          ? isSpeaking 
            ? 'bg-aim-accent/40 scale-125' 
            : 'bg-aim-purple/30 scale-100 animate-pulse-slow' 
          : 'bg-gray-800/10 scale-50'
      }`} />

      {/* 2. Acoustic Ripples (Only when speaking) */}
      {isActive && isSpeaking && (
        <>
           <div className="absolute inset-0 rounded-full border border-aim-accent/30 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
           <div className="absolute inset-4 rounded-full border border-aim-purple/30 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_200ms]" />
           <div className="absolute inset-8 rounded-full border border-white/10 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_400ms]" />
        </>
      )}

      {/* 3. Rotating Technical Rings */}
      <div className={`absolute w-48 h-48 rounded-full border border-white/10 transition-all duration-700 ${isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-20'}`}>
         {/* Outer Dashed Ring */}
         <div className={`absolute inset-0 rounded-full border border-dashed border-aim-purple/40 transition-transform duration-[10s] ease-linear ${isActive ? 'animate-[spin_10s_linear_infinite]' : ''}`} />
         
         {/* Inner Dashed Ring (Reverse) */}
         <div className={`absolute inset-2 rounded-full border border-dashed border-aim-accent/30 transition-transform duration-[10s] ease-linear ${isActive ? 'animate-[spin_15s_linear_infinite_reverse]' : ''}`} />
      </div>

      {/* 4. Main Core Container */}
      <div className={`relative z-10 w-32 h-32 rounded-full transition-all duration-500 flex items-center justify-center overflow-hidden ${
        isActive 
          ? isSpeaking 
            ? 'shadow-[0_0_50px_rgba(0,216,255,0.5)] scale-110' 
            : 'shadow-[0_0_20px_rgba(139,92,246,0.3)] scale-100'
          : 'bg-gray-900 border border-gray-800'
      }`}>
        
        {/* Core Gradient Background */}
        <div className={`absolute inset-0 transition-all duration-500 ${
           isActive 
             ? isSpeaking
               ? 'bg-gradient-to-br from-aim-accent via-blue-600 to-aim-purple'
               : 'bg-gradient-to-br from-aim-purple via-[#1a1033] to-black'
             : 'bg-black'
        }`} />

        {/* Glass Reflection Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 rounded-full pointer-events-none" />

        {/* Inner Content / Icon */}
        <div className={`relative z-20 transition-all duration-300 ${isSpeaking ? 'scale-110 text-white mix-blend-overlay' : 'scale-100 text-gray-400'}`}>
           {!isActive ? (
             <div className="w-3 h-3 rounded-full bg-gray-600" />
           ) : (
             <div className="flex gap-1 items-center justify-center h-8">
                {/* Animated Voice Bars */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-150 ${isSpeaking ? 'bg-white animate-glow' : 'bg-aim-accent/50'}`}
                    style={{
                      height: isSpeaking ? `${Math.random() * 24 + 12}px` : '4px',
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
             </div>
           )}
        </div>
      </div>
      
      {/* 5. Status Text Overlay */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap flex flex-col items-center gap-1">
        <span className={`text-[10px] font-mono tracking-[0.2em] uppercase transition-colors duration-300 ${isActive ? 'text-aim-accent' : 'text-gray-600'}`}>
          {isActive ? (isSpeaking ? 'VOICE ACTIVE' : 'LISTENING') : 'OFFLINE'}
        </span>
        {isActive && (
           <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
           </div>
        )}
      </div>
    </div>
  );
};
