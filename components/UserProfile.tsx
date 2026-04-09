
import React from 'react';
import { GeneratedImage } from '../types';
import { User, Image as ImageIcon, Clock, Database, X } from 'lucide-react';
import { playClickSound, playHoverSound } from '../services/soundEffects';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  projects: GeneratedImage[];
}

export const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose, projects }) => {
  if (!isOpen) return null;

  const completedCount = projects.filter(p => p.status === 'completed').length;
  const totalCount = projects.length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-end">
      <div className="w-full max-w-md bg-[#0f0d05] border-l border-amber-900/30 h-full shadow-2xl flex flex-col animate-[slideIn_0.3s_ease-out]">
        
        {/* Header */}
        <div className="p-6 border-b border-amber-900/30 flex items-center justify-between bg-[#1a1600]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aim-gold to-amber-700 flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-lg">Operative</h2>
              <p className="text-xs text-amber-500/70 font-mono uppercase">Level 1 • Access Granted</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            onMouseEnter={playHoverSound}
            className="p-2 hover:bg-amber-500/10 rounded-full transition-colors text-amber-700 hover:text-aim-gold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-px bg-amber-900/30">
          <div className="bg-[#0f0d05] p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <ImageIcon className="w-6 h-6 text-aim-gold mb-2" />
            <span className="text-2xl font-bold text-white">{completedCount}</span>
            <span className="text-xs text-amber-600 uppercase tracking-wider">Images</span>
          </div>
          <div className="bg-[#0f0d05] p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors">
            <Database className="w-6 h-6 text-amber-700 mb-2" />
            <span className="text-2xl font-bold text-white">{totalCount}</span>
            <span className="text-xs text-amber-600 uppercase tracking-wider">Total Tasks</span>
          </div>
        </div>

        {/* Project History */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Recent Activity
          </h3>
          
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="text-center py-10 text-amber-900/50 italic text-sm">
                No images found in database.
              </div>
            ) : (
              projects.map((project) => (
                <div 
                  key={project.id} 
                  onMouseEnter={playHoverSound}
                  className="bg-black/40 border border-amber-900/20 rounded p-3 hover:border-aim-gold/40 transition-colors group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                      project.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      project.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {project.status}
                    </span>
                    <span className="text-[10px] text-amber-800 font-mono">
                      {new Date(project.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-amber-100/70 line-clamp-2 font-mono leading-relaxed group-hover:text-white transition-colors">
                    {project.prompt}
                  </p>
                  {project.url && (
                     <a 
                       href={project.url} 
                       target="_blank" 
                       rel="noreferrer"
                       onClick={(e) => { e.stopPropagation(); playClickSound(); }}
                       className="mt-2 inline-flex items-center gap-1 text-xs text-aim-gold hover:underline"
                     >
                       View Output <span className="text-[10px]">↗</span>
                     </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
