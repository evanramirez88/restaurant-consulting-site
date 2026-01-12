/**
 * Sync Overlay Component
 * Full-screen overlay showing sync progress with animated steps
 */
import React from 'react';

interface SyncOverlayProps {
  isVisible: boolean;
  steps: string[];
  title?: string;
  subtitle?: string;
}

export const SyncOverlay: React.FC<SyncOverlayProps> = ({
  isVisible,
  steps,
  title = "Synchronizing Market Intelligence",
  subtitle = "Daily Scheduled Update"
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
      <div className="w-full max-w-md p-8">
        {/* Spinning Loader */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center text-gray-400 text-sm mb-8 uppercase tracking-widest">{subtitle}</p>

        {/* Steps Progress */}
        <div className="space-y-4 font-mono text-xs">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 animate-fade-in"
              style={{ animationDelay: `${idx * 0.2}s` }}
            >
              <span className="text-orange-500 flex-shrink-0">
                {idx === steps.length - 1 ? (
                  <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={idx === steps.length - 1 ? "text-white font-bold" : "text-gray-500"}>
                {step}
              </span>
            </div>
          ))}

          {/* Progress Bar */}
          <div className="h-1 w-full bg-gray-800 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500 ease-out"
              style={{ width: `${Math.min((steps.length / 5) * 100, 100)}%` }}
            ></div>
          </div>

          {/* Percentage */}
          <div className="text-center text-gray-500 text-xs mt-2">
            {Math.round(Math.min((steps.length / 5) * 100, 100))}% Complete
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncOverlay;
