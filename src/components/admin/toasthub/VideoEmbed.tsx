import React, { useState } from 'react';
import { Play, Video, X, ExternalLink, Link2, Check, Copy } from 'lucide-react';

interface VideoEmbedProps {
  url?: string;
  onInsert?: (markdown: string) => void;
  mode?: 'display' | 'insert';
}

interface ParsedVideo {
  platform: 'youtube' | 'vimeo' | 'loom' | 'unknown';
  id: string;
  embedUrl: string;
  thumbnailUrl?: string;
}

function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url) return null;

  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        platform: 'youtube',
        id: match[1],
        embedUrl: `https://www.youtube.com/embed/${match[1]}`,
        thumbnailUrl: `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`
      };
    }
  }

  // Vimeo patterns
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) {
    return {
      platform: 'vimeo',
      id: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    };
  }

  // Loom patterns
  const loomMatch = url.match(/(?:loom\.com\/share\/)([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return {
      platform: 'loom',
      id: loomMatch[1],
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`
    };
  }

  return null;
}

// Display mode - renders the video player
function VideoPlayer({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const video = parseVideoUrl(url);

  if (!video) {
    return (
      <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Invalid video URL</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline text-xs mt-2 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Open link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
      {!loaded && video.thumbnailUrl && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={video.thumbnailUrl}
            alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setError(true)}
          />
          <div className="absolute inset-0 bg-black/40" />
          <button
            onClick={() => setLoaded(true)}
            className="relative z-10 w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors"
          >
            <Play className="w-8 h-8 text-white ml-1" />
          </button>
        </div>
      )}

      {(loaded || error || !video.thumbnailUrl) && (
        <iframe
          src={video.embedUrl}
          title="Video player"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Platform badge */}
      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white capitalize">
        {video.platform}
      </div>
    </div>
  );
}

// Insert mode - UI for inserting video markdown
function VideoInsertPanel({ onInsert }: { onInsert: (markdown: string) => void }) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<ParsedVideo | null>(null);
  const [copied, setCopied] = useState(false);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setPreview(parseVideoUrl(value));
  };

  const handleInsert = () => {
    if (!url || !preview) return;

    // Generate markdown with video embed div
    const markdown = `
<div class="video-embed" data-platform="${preview.platform}" data-id="${preview.id}">
  <iframe src="${preview.embedUrl}" frameborder="0" allowfullscreen style="width: 100%; aspect-ratio: 16/9;"></iframe>
</div>
`.trim();

    onInsert(markdown);
    setUrl('');
    setPreview(null);
  };

  const copyEmbedCode = () => {
    if (!preview) return;
    navigator.clipboard.writeText(`<iframe src="${preview.embedUrl}" frameborder="0" allowfullscreen></iframe>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Video URL</label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Paste YouTube, Vimeo, or Loom URL..."
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Supports YouTube, Vimeo, and Loom videos
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <iframe
              src={preview.embedUrl}
              title="Video preview"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              <span className="capitalize">{preview.platform}</span> video detected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyEmbedCode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied!' : 'Copy embed'}
              </button>
              <button
                onClick={handleInsert}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {url && !preview && (
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 text-gray-400">
            <Video className="w-5 h-5" />
            <span className="text-sm">Couldn't detect video. Please check the URL.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Video Embed Modal for inserting videos into content
export function VideoEmbedModal({
  isOpen,
  onClose,
  onInsert
}: {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-amber-400" />
            Insert Video
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <VideoInsertPanel
            onInsert={(markdown) => {
              onInsert(markdown);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Main component - can be used for display or insert
export default function VideoEmbed({ url, onInsert, mode = 'display' }: VideoEmbedProps) {
  if (mode === 'insert' && onInsert) {
    return <VideoInsertPanel onInsert={onInsert} />;
  }

  if (url) {
    return <VideoPlayer url={url} />;
  }

  return null;
}
