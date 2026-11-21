import { useState } from 'react';

// Put the official file at src/web/public/powercoders-logo.png
export function Logo({ className = "h-9" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-xl font-bold tracking-tight text-brand">powercoders</span>;
  return <img src="/powercoders-logo.png" alt="Powercoders" className={className} onError={() => setFailed(true)} />;
}
