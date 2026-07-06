// src/components/feedback/PageLoader.tsx
import React from 'react'

export function PageLoader(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-background">
      {/* Concentric ring pulse */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <span className="h-5 w-5 rounded-full bg-primary/60" />
        </span>
      </div>

      {/* Loading bar */}
      <div className="w-32 overflow-hidden rounded-full bg-muted">
        <div
          className="h-[3px] w-1/2 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-primary"
          style={{
            animation: 'loading-bar 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes loading-bar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(180%);  }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
