"use client";

import { useState, useEffect } from 'react';

export function ProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Listen for progress updates from the WebSocket
    const handleProgress = (event: any) => {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        setProgress(data.data.progress);
      }
    };

    // Try to connect to WebSocket for real-time updates
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/websocket`);
      ws.onmessage = handleProgress;
    } catch (err) {
      // WebSocket not available, use polling
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  if (progress === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-400 mb-2">
        <span>Processing</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
