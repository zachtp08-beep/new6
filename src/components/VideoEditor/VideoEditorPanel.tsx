"use client";

import { useState } from 'react';
import { ClipConfig, AspectRatioConfig, SplitScreenConfig, SubtitleConfig, VideoOperation } from '@/types';

export function VideoEditorPanel() {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [clipConfig, setClipConfig] = useState<ClipConfig>({ clipDuration: 30 });
  const [aspectRatioConfig, setAspectRatioConfig] = useState<AspectRatioConfig>({ ratio: '9:16' });
  const [splitScreenConfig, setSplitScreenConfig] = useState<SplitScreenConfig>({ secondaryVideo: '', layout: 'vertical' });
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({ language: 'eng' });
  const [primaryVideo, setPrimaryVideo] = useState<File | null>(null);
  const [secondaryVideo, setSecondaryVideo] = useState<File | null>(null);

  const handlePrimaryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i))) {
      setPrimaryVideo(file);
    }
  };

  const handleSecondaryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i))) {
      setSecondaryVideo(file);
    }
  };


  const handleAddOperation = (type: VideoOperation['type']) => {
    let params = {};
    switch (type) {
      case 'clip':
        params = clipConfig;
        break;
      case 'aspect-ratio':
        params = aspectRatioConfig;
        break;
      case 'split-screen':
        params = splitScreenConfig;
        break;
      case 'subtitles':
        params = subtitleConfig;
        break;
    }
    window.dispatchEvent(new CustomEvent('addOperation', { detail: { type, params } }));
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        Video Editing Tools
      </h2>

      <div className="mb-6 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
        <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8m-4-4v8m-8-4h8m-8-8v8m-4-4h16" />
          </svg>
          Split-Screen Videos (Primary Top / Secondary Bottom)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-dashed border-green-500/30 rounded-lg p-4 hover:border-green-500/50 transition-colors">
            <label className="cursor-pointer flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19l11-11 5 5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l6 0" />
                </svg>
              </div>
              <span className="text-sm font-medium text-green-400">Primary Video (Top)</span>
              <span className="text-xs text-gray-400">Appears above</span>
              <input type="file" accept="video/*" onChange={handlePrimaryUpload} className="hidden" />
            </label>
            {primaryVideo && <p className="text-xs text-green-400 mt-1 truncate">{primaryVideo.name}</p>}
          </div>
          <div className="border-2 border-dashed border-blue-500/30 rounded-lg p-4 hover:border-blue-500/50 transition-colors">
            <label className="cursor-pointer flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 5l-7 7-7-7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5l0 14" />
                </svg>
              </div>
              <span className="text-sm font-medium text-blue-400">Secondary Video (Bottom)</span>
              <span className="text-xs text-gray-400">Appears below</span>
              <input type="file" accept="video/*" onChange={handleSecondaryUpload} className="hidden" />
            </label>
            {secondaryVideo && <p className="text-xs text-blue-400 mt-1 truncate">{secondaryVideo.name}</p>}
          </div>
        </div>
        {primaryVideo && secondaryVideo && <p className="text-xs text-green-400 mt-2">Both uploaded - ready for split-screen!</p>}
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors">
          <h3 className="font-medium text-white mb-3">Smart Clipping</h3>
          <p className="text-sm text-gray-400 mb-3">Split video into clips</p>
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Clip Duration (seconds)</label>
            <input
              type="number"
              value={clipConfig.clipDuration}
              onChange={(e) => setClipConfig({ ...clipConfig, clipDuration: Number(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              min="1"
            />
          </div>
          <button
            onClick={() => handleAddOperation('clip')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Add Clipping
          </button>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-purple-500 transition-colors">
          <h3 className="font-medium text-white mb-3">Aspect Ratio</h3>
          <p className="text-sm text-gray-400 mb-3">Convert for iPhone (9:16)</p>
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Ratio</label>
            <select
              value={aspectRatioConfig.ratio}
              onChange={(e) => setAspectRatioConfig({ ...aspectRatioConfig, ratio: e.target.value as '9:16' | '16:9' | '1:1' | '4:5' | '4:3' })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="9:16">9:16 (iPhone)</option>
              <option value="16:9">16:9 (Standard)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5</option>
              <option value="4:3">4:3</option>
            </select>
          </div>
          <button
            onClick={() => handleAddOperation('aspect-ratio')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Add Aspect Ratio
          </button>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-green-500 transition-colors">
          <h3 className="font-medium text-white mb-3">Split Screen</h3>
          <p className="text-sm text-gray-400 mb-3">Combine two videos</p>
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Layout</label>
            <select
              value={splitScreenConfig.layout}
              onChange={(e) => setSplitScreenConfig({ ...splitScreenConfig, layout: e.target.value as 'horizontal' | 'vertical' | 'overlay' })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="vertical">Vertical (Side by Side)</option>
              <option value="horizontal">Horizontal (Top/Bottom)</option>
              <option value="overlay">Overlay</option>
            </select>
          </div>
          <button
            onClick={() => handleAddOperation('split-screen')}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Add Split Screen
          </button>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-yellow-500 transition-colors">
          <h3 className="font-medium text-white mb-3">Auto Subtitles</h3>
          <p className="text-sm text-gray-400 mb-3">Generate captions</p>
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Language</label>
            <input
              type="text"
              value={subtitleConfig.language}
              onChange={(e) => setSubtitleConfig({ ...subtitleConfig, language: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="eng"
            />
          </div>
          <button
            onClick={() => handleAddOperation('subtitles')}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Add Subtitles
          </button>
        </div>
      </div>
    </div>
  );
}
