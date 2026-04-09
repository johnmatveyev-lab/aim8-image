
import React from 'react';
import { GeneratedImage } from '../types';
import { AlertTriangle, CheckCircle2, Download, Hourglass, Cpu, Sparkles, Layers, Image as ImageIcon } from 'lucide-react';
import { playHoverSound } from '../services/soundEffects';

interface ImageListProps {
  images: GeneratedImage[];
  onSelect?: (id: string) => void;
}

export const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('queued') || s.includes('pending')) return 'text-yellow-600';
  if (s.includes('processing') || s.includes('analyzing')) return 'text-amber-400';
  if (s.includes('rendering') || s.includes('generating')) return 'text-aim-gold';
  if (s.includes('failed')) return 'text-red-500';
  if (s.includes('completed')) return 'text-green-400';
  return 'text-aim-gold';
};

export const getStatusGlow = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('queued') || s.includes('pending')) return 'bg-yellow-600/10 shadow-[0_0_15px_rgba(202,138,4,0.2)]';
  if (s.includes('processing') || s.includes('analyzing')) return 'bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.2)]';
  if (s.includes('rendering') || s.includes('generating')) return 'bg-aim-gold/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
  return 'bg-aim-gold/10';
};

export const StatusIcon = ({ status, className }: { status: string, className?: string }) => {
  const s = status.toLowerCase();
  if (s.includes('queued') || s.includes('pending')) return <Hourglass className={className} />;
  if (s.includes('processing') || s.includes('analyzing')) return <Cpu className={className} />;
  if (s.includes('rendering') || s.includes('generating')) return <Sparkles className={className} />;
  return null;
};

export const CircularProgress = ({ progress, status }: { progress: number; status: string }) => {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(progress, 2) / 100) * circumference;
  const colorClass = getStatusColor(status);
  const glowClass = getStatusGlow(status);

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Pulsing Background for active state */}
      <div className={`absolute inset-2 rounded-full ${glowClass} animate-pulse blur-sm transition-all duration-500`}></div>

      <svg className="transform -rotate-90 w-full h-full relative z-10 drop-shadow-lg">
        <circle
          className="text-amber-900/40"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
        />
        <circle
          className={`${colorClass} transition-all duration-700 ease-out`}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
        />
      </svg>
      
      {/* Inner Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        {status.toLowerCase().includes('queued') && progress === 0 ? (
          <Hourglass className={`w-5 h-5 ${colorClass} animate-pulse opacity-80`} />
        ) : (
          <span className="text-sm font-mono font-bold text-aim-gold drop-shadow-md">
            {Math.round(progress)}%
          </span>
        )}
      </div>
    </div>
  );
};

export const ImageList: React.FC<ImageListProps> = ({ images, onSelect }) => {
  if (images.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-4 px-4 mb-20">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {images.map((img) => (
          <div 
            key={img.id} 
            onClick={() => onSelect?.(img.id)}
            onMouseEnter={playHoverSound}
            className="bg-[#0f0d05] border border-amber-900/30 rounded-lg overflow-hidden shadow-2xl flex flex-col relative group hover:border-aim-gold/50 transition-all duration-300 cursor-pointer hover:shadow-[0_0_30px_rgba(234,179,8,0.1)]"
          >
            <div className="aspect-square bg-black relative flex items-center justify-center group-hover:bg-amber-950/10 transition-colors">
              {img.status === 'completed' && img.url ? (
                <div className="relative w-full h-full">
                  <img 
                    src={img.url} 
                    alt={img.prompt}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                     <ImageIcon className="w-12 h-12 text-aim-gold drop-shadow-lg transform group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              ) : img.status === 'failed' ? (
                <div className="text-red-500 flex flex-col items-center p-4 text-center animate-pulse">
                  <AlertTriangle className="w-12 h-12 mb-3 opacity-80" />
                  <span className="text-xs uppercase tracking-widest font-bold">Generation Failed</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full bg-black/50 backdrop-blur-sm">
                  <div className="mb-3">
                    <CircularProgress 
                      progress={img.progress || 0} 
                      status={img.detailedStatus || 'Processing'} 
                    />
                  </div>
                  <div className="flex flex-col items-center space-y-1">
                    <div className={`flex items-center gap-1.5 ${getStatusColor(img.detailedStatus || 'Processing')} font-bold tracking-widest uppercase text-xs animate-pulse`}>
                       <StatusIcon status={img.detailedStatus || 'Processing'} className="w-3 h-3" />
                       <span>{img.detailedStatus || 'PROCESSING'}</span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-mono">
                       ~15s Remaining
                    </span>
                  </div>
                </div>
              )}
              
              {/* Status Badge */}
              {img.status !== 'generating' && (
                <div className={`absolute top-2 left-2 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg
                  ${img.status === 'completed' ? 'bg-green-900/80 border-green-500/50 text-green-400' : 'bg-red-900/80 border-red-500/50 text-red-400'}`
                }>
                  {img.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {img.status}
                </div>
              )}

              {/* Model Badge */}
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md border border-amber-500/20 rounded text-[9px] font-mono text-aim-gold uppercase flex items-center gap-1.5">
                 <Layers className="w-3 h-3" />
                 {img.model || 'Nano'}
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-b from-[#1a1600] to-black border-t border-amber-900/20">
              <p className="text-sm text-amber-100/80 line-clamp-2 font-mono leading-relaxed group-hover:text-white transition-colors" title={img.prompt}>
                <span className="text-aim-gold mr-2">$</span>
                {img.prompt}
              </p>
              <div className="mt-3 flex justify-between items-center text-[10px] text-amber-800 font-mono border-t border-amber-900/30 pt-2">
                 <span className="flex items-center gap-1">
                   ID: <span className="text-amber-700">{img.id.slice(0, 8)}</span>
                 </span>
                 <span>{new Date(img.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
