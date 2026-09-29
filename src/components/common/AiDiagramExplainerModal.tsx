import React, { useState } from 'react';
import { Volume2, VolumeX, X, Sparkles, Eye, CheckCircle2, Lightbulb, Play, Pause } from 'lucide-react';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { speechEngine } from '../../utils/speechEngine';
import type { AiDiagramExplanation } from '../../../shared/types';

interface AiDiagramExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionNumber?: number;
  questionText: string;
  diagramUrl?: string;
  diagramDescription?: string;
  aiExplanation?: AiDiagramExplanation;
}

export const AiDiagramExplainerModal: React.FC<AiDiagramExplainerModalProps> = ({
  isOpen,
  onClose,
  questionNumber,
  questionText,
  diagramUrl,
  diagramDescription,
  aiExplanation,
}) => {
  const { announce } = useAnnouncerStore();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        speechEngine.stop();
        setIsPlayingAudio(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const audioText =
    aiExplanation?.audioNarration ||
    `Diagram analysis for Question ${questionNumber || ''}: ${diagramDescription || questionText}. ${
      aiExplanation?.educationalContext || ''
    }`;

  const handleToggleVoice = () => {
    if (isPlayingAudio || speechEngine.isSpeaking()) {
      speechEngine.stop();
      setIsPlayingAudio(false);
      announce('Diagram audio narration stopped.', 'polite', true);
    } else {
      setIsPlayingAudio(true);
      announce(
        `Starting AI Diagram Audio Narration. ${audioText}`,
        'assertive',
        true
      );
      // Listen for speech end
      speechEngine.onSpeechEnd(() => setIsPlayingAudio(false));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-explainer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-theme-surface border-2 border-indigo-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-900 text-white flex items-center justify-between border-b border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900">
                  AI Multimodal Vision
                </span>
                <span className="text-xs text-indigo-200 font-semibold">
                  {questionNumber ? `Question Q${questionNumber}` : 'Interactive Analysis'}
                </span>
              </div>
              <h2 id="diagram-explainer-title" className="text-xl sm:text-2xl font-black text-white">
                AI Diagram Explainer & Audio Guide
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              speechEngine.stop();
              setIsPlayingAudio(false);
              onClose();
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition focus:ring-2 focus:ring-white"
            aria-label="Close AI Diagram Explainer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-theme-text font-sans">
          {/* Audio Narration Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-pink-500/15 border-2 border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-theme-text">Voice Audio Diagram Guide</h3>
                <p className="text-xs text-theme-text/70">
                  Synthesized speech breakdown designed for screen-readers & visually impaired students.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md ${
                  isPlayingAudio
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause Audio</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Listen Diagram Breakdown</span>
                  </>
                )}
              </button>

              {isPlayingAudio && (
                <button
                  type="button"
                  onClick={() => {
                    speechEngine.stop();
                    setIsPlayingAudio(false);
                  }}
                  className="p-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition"
                  title="Stop Speech"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Diagram Preview */}
          {diagramUrl && (
            <div className="p-4 rounded-2xl bg-theme-bg border-2 border-theme-border flex flex-col items-center justify-center">
              <img
                src={diagramUrl}
                alt={diagramDescription || 'Question diagram preview'}
                className="max-h-64 object-contain rounded-lg shadow-sm"
              />
              {diagramDescription && (
                <p className="text-xs font-mono text-theme-text/60 mt-2 text-center max-w-lg">
                  Caption: {diagramDescription}
                </p>
              )}
            </div>
          )}

          {/* 1. Visual Elements Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-500 font-extrabold text-base">
              <Eye className="w-5 h-5 text-indigo-500" />
              <span>1. Visual Elements & Spatial Structure</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(aiExplanation?.visualBreakdown?.length
                ? aiExplanation.visualBreakdown
                : [
                    diagramDescription || 'Diagram represents geometry/data elements.',
                    'Key parameters labeled on shapes/axes.',
                  ]
              ).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-theme-bg border border-theme-border flex items-start gap-2 text-xs font-medium"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-theme-text">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Educational Context & Solving Step */}
          <div className="p-5 rounded-2xl bg-indigo-500/5 border-2 border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-base">
              <Lightbulb className="w-5 h-5" />
              <span>2. How to Read & Solve from Diagram</span>
            </div>
            <p className="text-sm leading-relaxed text-theme-text font-medium">
              {aiExplanation?.educationalContext ||
                `The diagram depicts visual variables related to the problem statement "${questionText}". Analyze the labeled positions and apply the corresponding mathematical or logical steps to resolve the options.`}
            </p>
          </div>

          {/* 3. Key Takeaways */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-base">
              <CheckCircle2 className="w-5 h-5" />
              <span>3. Key Diagnostic Findings</span>
            </div>
            <ul className="space-y-2">
              {(aiExplanation?.keyPoints?.length
                ? aiExplanation.keyPoints
                : ['Verify labels on the diagram.', 'Apply correct formulas.', 'Cross-check options.']
              ).map((kp, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-theme-text flex items-center gap-2"
                >
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-theme-bg border-t border-theme-border flex items-center justify-between text-xs text-theme-text/60">
          <span>Powered by DristiX Multimodal AI & Speech Engine</span>
          <button
            type="button"
            onClick={() => {
              speechEngine.stop();
              setIsPlayingAudio(false);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-theme-surface border border-theme-border hover:border-theme-primary font-bold text-theme-text transition"
          >
            Close Explainer
          </button>
        </div>
      </div>
    </div>
  );
};
