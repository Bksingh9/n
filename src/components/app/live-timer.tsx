'use client';
import * as React from 'react';

export function LiveTimer({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return <p className="text-2xl font-semibold tabular-nums mt-1">—</p>;
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return (
    <p className="text-2xl font-semibold tabular-nums mt-1">
      {min}:{sec.toString().padStart(2, '0')}
    </p>
  );
}
