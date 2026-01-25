import React, { useState, useEffect } from 'react';
import {
  BookOpen, Search, Bookmark, BookmarkCheck, Filter, Loader2,
  Clock, Tag, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

interface KnowledgeBasePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_format: string;
  category: string | null;
  tags_json: string | null;
  published_at: number | null;
  view_count: number;
  access_level: string;
  granted_at: number;
  expires_at: number | null;
  is_bookmarked: number;
}

interface Category {
  category: string;
  count: number;
}

// This component is for the client portal, not admin
// It shows content that has been shared with the logged-in client
export default function ClientKnowledgeBase() {
  const [posts, setPosts] = useState<KnowledgeBasePost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [bookmarking, setBookmarking] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [bookmarksCount, setBookmarksCount] = useState(0);

  useEffect(() => {
    loadKnowledgeBase();
  }, [categoryFilter, showBookmarked]);

  const loadKnowledgeBase = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (showBookmarked) params.set('bookmarked', 'true');
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/client-portal/knowledge-base?${params}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setPosts(data.data.posts || []);
        setCategories(data.data.categories || []);
        setTotal(data.data.total || 0);
        setBookmarksCount(data.data.bookmarks_count || 0);
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadKnowledgeBase();
  };

  const toggleBookmark = async (postId: string, isBookmarked: boolean) => {
    setBookmarking(postId);
    try {
      const res = await fetch('/api/client-portal/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content_id: postId,
          action: isBookmarked ? 'unbookmark' : 'bookmark'
        })
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, is_bookmarked: isBookmarked ? 0 : 1 } : p
        ));
        setBookmarksCount(prev => isBookmarked ? prev - 1 : prev + 1);
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    } finally {
      setBookmarking(null);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const parseTags = (tagsJson: string | null): string[] => {
    if (!tagsJson) return [];
    try {
      return JSON.parse(tagsJson);
    } catch {
      return [];
    }
  };

  // Simple markdown to HTML converter for content display
  const renderContent = (content: string | null, format: string) => {
    if (!content) return null;
    if (format === 'html') {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }
    // Basic markdown rendering
    const html = content
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-amber-400">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-amber-400 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-300 mb-4">');

    return (
      <div
        className="prose prose-invert prose-amber max-w-none"
        dangerouslySetInnerHTML={{ __html: `<p class="text-gray-300 mb-4">${html}</p>` }}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            Knowledge Base
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {total} resource{total !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={() => setShowBookmarked(!showBookmarked)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            showBookmarked
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Bookmarks ({bookmarksCount})
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 border border-gray-700 rounded-lg">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {showBookmarked ? 'No bookmarked resources' : 'No resources available yet'}
          </p>
          {showBookmarked && (
            <button
              onClick={() => setShowBookmarked(false)}
              className="mt-4 text-amber-400 hover:underline text-sm"
            >
              View all resources
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div
              key={post.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {post.category && (
                        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded capitalize">
                          {post.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(post.published_at)}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{post.excerpt}</p>
                    )}
                    {/* Tags */}
                    {parseTags(post.tags_json).length > 0 && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Tag className="w-3 h-3 text-gray-500" />
                        {parseTags(post.tags_json).slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(post.id, !!post.is_bookmarked);
                      }}
                      disabled={bookmarking === post.id}
                      className={`p-2 rounded-lg transition-colors ${
                        post.is_bookmarked
                          ? 'text-amber-400 hover:bg-amber-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {bookmarking === post.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : post.is_bookmarked ? (
                        <BookmarkCheck className="w-5 h-5" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>
                    {expandedPost === post.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedPost === post.id && post.content && (
                <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
                  {renderContent(post.content, post.content_format)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
