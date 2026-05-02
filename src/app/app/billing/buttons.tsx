'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';

export function CheckoutButton({ plan }: { plan: 'starter' | 'pro' | 'agency' }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Checkout unavailable');
        return;
      }
      window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Button onClick={onClick} disabled={loading} className="w-full">
        {loading ? 'Loading…' : `Upgrade to ${plan[0].toUpperCase()}${plan.slice(1)}`}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PortalButton() {
  const [loading, setLoading] = React.useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button onClick={onClick} disabled={loading} variant="outline" className="w-full">
      {loading ? 'Loading…' : 'Manage subscription'}
    </Button>
  );
}
