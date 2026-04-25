"use client";

import { useState, useEffect } from 'react';
import { VideoJob } from '@/types';

export default function CompletedPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'processing' | 'pending'>('all');

  useEffect(() => {
    const fetchJobsAsync = async () => {
      try {
        const res = await fetch('/api/jobs?limit=100');
        const data = await res.json();
        if (data.success) {
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
      }
    };
    fetchJobsAsync();
    const interval = setInterval(fetchJobsAsync, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const formatBytes = (bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getStatusCount = (status: VideoJob['status']) => {
    return jobs.filter(j => j.status === status).length;
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Completed Videos</h1>
          <p className="text-gray-400">View all processed videos and their details</p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Completed ({getStatusCount('completed')})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Failed ({getStatusCount('failed')})
          </button>
          <button
            onClick={() => setFilter('processing')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'processing'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Processing ({getStatusCount('processing')})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Pending ({getStatusCount('pending')})
          </button>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/50 rounded-xl border border-gray-700">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-medium text-gray-400 mb-2">No completed videos yet</h3>
            <p className="text-gray-500">Upload and process a video to see it appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className={`bg-gray-800/50 rounded-xl border ${
                  job.status === 'completed'
                    ? 'border-green-500/20'
                    : job.status === 'failed'
                    ? 'border-red-500/20'
                    : 'border-gray-700'
                } overflow-hidden hover:border-opacity-100 transition-colors`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-gray-400 truncate max-w-[120px]">
                        {job.originalFilename}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium shrink-0 ${
                        job.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : job.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : job.status === 'processing'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Duration</span>
                      <span className="text-gray-200">{formatDuration(job.duration)}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Size</span>
                      <span className="text-gray-200">{formatBytes(job.processedSize || job.originalSize)}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Operations</span>
                      <span className="text-gray-200">{job.operations.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>Date</span>
                      <span className="text-gray-200">{formatDate(job.uploadedAt)}</span>
                    </div>
                  </div>

                  {job.operations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-2">Operations:</p>
                      <div className="flex flex-wrap gap-1">
                        {job.operations.map((op, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-400"
                          >
                            {op.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{job.error}</p>
                    </div>
                  )}

                  {job.outputPath && job.status === 'completed' && (
                    <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Ready to download</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {jobs.length > 0 && (
          <div className="mt-6 text-center text-gray-500 text-sm">
            Showing {filteredJobs.length} of {jobs.length} videos
          </div>
        )}
      </main>
    </div>
  );
}

