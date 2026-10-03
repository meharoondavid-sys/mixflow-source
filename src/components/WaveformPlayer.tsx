import React, { useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Layers, 
  Activity, 
  Clock, 
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MixVersion, Comment } from '../types';

interface WaveformPlayerProps {
  version: MixVersion;
  allVersions: MixVersion[];
  comments: Comment[];
  onAddCommentAtCurrentTime?: (time: number) => void;
  isClientMode?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  version,
  allVersions,
  comments,
  onAddCommentAtCurrentTime,
  isClientMode = false
}) => {
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    togglePlay, 
    seek, 
    volume, 
    setVolume, 
    switchActiveVersion 
  } = useApp();

  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredComment, setHoveredComment] = useState<Comment | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seek(ratio * duration);
  };

  const handleWaveformMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setHoveredTime(ratio * duration);
  };

  const handleWaveformMouseLeave = () => {
    setHoveredTime(null);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume || 0.8);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const versionComments = comments.filter(c => c.versionId === version.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const peaks = version.waveformPeaks || [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* Background subtle acoustic grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '16px 16px' }} 
      />

      {/* Top Track & Master Spec Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm">
            V{version.versionNumber}
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-zinc-100 flex items-center gap-2">
              <span>{version.versionName}</span>
              {isPlaying && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span>{version.sampleRate}</span>
              <span aria-hidden="true">·</span>
              <span>{version.bitDepth}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400/90">{version.lufs.toFixed(1)} LUFS</span>
            </div>
          </div>
        </div>

        {/* Quick A/B Version Comparison Selector */}
        {allVersions.length > 1 && (
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
            <span className="text-[11px] text-zinc-400 font-mono px-2 flex items-center gap-1">
              <Layers size={13} className="text-emerald-400" /> A/B Compare:
            </span>
            {allVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => switchActiveVersion(v.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  v.id === version.id
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title={`Switch to ${v.versionName}`}
              >
                V{v.versionNumber}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Interactive Waveform Display */}
      <div className="relative mb-6 z-10 select-none">
        <div
          ref={containerRef}
          onClick={handleWaveformClick}
          onMouseMove={handleWaveformMouseMove}
          onMouseLeave={handleWaveformMouseLeave}
          className="w-full h-28 sm:h-32 bg-zinc-950 rounded-xl border border-zinc-800/80 p-3 flex items-center gap-[2px] sm:gap-[3px] cursor-pointer group relative overflow-hidden"
        >
          {/* Waveform Bars */}
          {peaks.map((peak, index) => {
            const barPercent = (index / peaks.length) * 100;
            const isPlayed = barPercent <= progressPercent;
            const heightPercent = Math.max(14, peak * 92);

            return (
              <div
                key={index}
                className="flex-1 flex flex-col justify-center items-center h-full"
              >
                <div
                  className={`w-full rounded-full transition-colors duration-150 ${
                    isPlayed
                      ? 'bg-emerald-400 group-hover:bg-emerald-300'
                      : 'bg-zinc-800 group-hover:bg-zinc-700'
                  }`}
                  style={{
                    height: `${heightPercent}%`,
                    minWidth: '2px',
                    maxWidth: '6px'
                  }}
                />
              </div>
            );
          })}

          {/* Glowing Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 pointer-events-none shadow-[0_0_12px_rgba(52,211,153,0.8)] z-20 transition-all duration-75"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-emerald-400 -mt-1 shadow-md" />
          </div>

          {/* Hover Scrub Indicator */}
          {hoveredTime !== null && (
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-zinc-400 pointer-events-none z-10"
              style={{ left: `${(hoveredTime / duration) * 100}%` }}
            >
              <div className="absolute top-2 -left-6 bg-zinc-800 text-zinc-200 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700">
                {formatTime(hoveredTime)}
              </div>
            </div>
          )}

          {/* Comment Flag Markers pinned to timeline */}
          {versionComments.map((comment) => {
            const markerPercent = duration > 0 ? (comment.timestampSeconds / duration) * 100 : 0;
            return (
              <div
                key={comment.id}
                onClick={(e) => {
                  e.stopPropagation();
                  seek(comment.timestampSeconds);
                }}
                onMouseEnter={() => setHoveredComment(comment)}
                onMouseLeave={() => setHoveredComment(null)}
                className="absolute bottom-1 -translate-x-1/2 z-30 cursor-pointer group/pin"
                style={{ left: `${markerPercent}%` }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-transform hover:scale-125 border ${
                    comment.resolved
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-400'
                      : 'bg-emerald-500 border-emerald-300 text-black shadow-lg shadow-emerald-500/30'
                  }`}
                >
                  <MessageSquare size={8} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Comment Tooltip Card */}
        {hoveredComment && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 shadow-2xl max-w-xs text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-emerald-400">{hoveredComment.author}</span>
              <span className="font-mono text-[10px] text-zinc-400">
                {formatTime(hoveredComment.timestampSeconds)}
              </span>
            </div>
            <p className="text-zinc-300 line-clamp-2">{hoveredComment.text}</p>
          </div>
        )}
      </div>

      {/* Player Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        {/* Play / Skip / Time Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => seek(Math.max(0, currentTime - 5))}
            className="w-9 h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
            title="Rewind 5s"
            aria-label="Rewind 5 seconds"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            title={isPlaying ? 'Pause audio' : 'Play audio'}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause size={22} className="fill-current" />
            ) : (
              <Play size={22} className="fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seek(Math.min(duration, currentTime + 5))}
            className="w-9 h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
            title="Forward 5s"
            aria-label="Skip forward 5 seconds"
          >
            <RotateCw size={16} />
          </button>

          {/* Time Display */}
          <div className="ml-2 font-mono text-sm tracking-tight text-zinc-200">
            <span className="font-bold text-emerald-400 tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-zinc-500 mx-1">/</span>
            <span className="text-zinc-400 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Timestamp Quick Action */}
        <div className="flex items-center gap-4">
          {/* Quick Add Timestamp Note Button */}
          {onAddCommentAtCurrentTime && (
            <button
              onClick={() => onAddCommentAtCurrentTime(currentTime)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-medium border border-zinc-700/60 transition-colors"
            >
              <MessageSquare size={13} className="text-emerald-400" />
              <span>Add Note at {formatTime(currentTime)}</span>
            </button>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setIsMuted(false);
                setVolume(parseFloat(e.target.value));
              }}
              className="w-20 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              title="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
