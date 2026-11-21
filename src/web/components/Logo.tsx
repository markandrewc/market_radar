import { useState } from 'react';

// Put the official file at src/web/public/powercoders-logo.png
// The header passes `h-7`; a plain text mark keeps the link readable if the file is missing.
export function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-xl font-semibold tracking-tight text-brand">powercoders</span>;
  return <img src="/powercoders-logo.png" alt="Powercoders" className={className} onError={() => setFailed(true)} />;
}
