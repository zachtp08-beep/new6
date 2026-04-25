"use client";

import { useState, useEffect } from 'react';

export function ProcessingStatus() {
  const [status, setStatus] = useState({ queue: 0, active: 0 });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setStatus(data.stats.queue);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800/30 rounded-lg p-4 mb-6 border border-gray-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">{status.active} processing</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-sm text-gray-400">{status.queue} queued</span>
          </span>
        </div>
        <div className="text-sm text-gray-500">Live</div>
      </div>
    </div>
  );
}
