/** Allswell delta-wing mark + joint wordmark with Win Far Fishery (穩發漁業). */
export function DeltaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="alw-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fe6ff" />
          <stop offset="1" stopColor="#1fa8d2" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 L22 20.5 L12 16.2 L2 20.5 Z" fill="url(#alw-mark)" />
      <path d="M12 2.5 L12 16.2" stroke="#04070d" strokeWidth="1.1" strokeOpacity="0.6" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3 select-none">
      <DeltaMark className="h-7 w-7 drop-shadow-[0_0_10px_rgba(63,211,255,0.45)]" />
      <div className="flex items-baseline gap-2.5 leading-none">
        <span className="text-[17px] font-bold tracking-[0.22em] text-text">ALLSWELL</span>
        <span className="text-[13px] text-dim">×</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[19px] font-bold tracking-[0.08em] text-text">穩發</span>
          <span className="text-[9px] font-semibold tracking-[0.2em] text-muted">WIN FAR</span>
        </span>
      </div>
    </div>
  );
}
