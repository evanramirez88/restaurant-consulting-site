import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Edit3, Trash2, Eye, EyeOff, Calendar,
  Tag, Loader2, RefreshCw, Star, ExternalLink, ToggleLeft, ToggleRight,
  Monitor, X, Globe, Check, AlertCircle, Save
} from 'lucide-react';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  author: string | null;
  published_at: number | null;
  scheduled_for: number | null;
  view_count: number;
  featured: boolean;
  created_at: number;
  updated_at: number;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

const ToastHubManager: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [postsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/posts'),
        fetch('/api/admin/categories')
      ]);

      const postsResult = await postsRes.json();
      const categoriesResult = await categoriesRes.json();

      if (postsResult.success) setPosts(postsResult.data || []);
      if (categoriesResult.success) setCategories(categoriesResult.data || []);
    } catch (error) {
      console.error('Failed to load Toast Hub data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const toggleFeatured = async (post: Post) => {
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !post.featured })
      });
      const result = await response.json();
      if (result.success) {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, featured: !p.featured } : p));
      }
    } catch (error) {
      console.error('Failed to update post:', error);
    }
  };

  const togglePublished = async (post: Post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          published_at: newStatus === 'published' ? Math.floor(Date.now() / 1000) : null
        })
      });
      const result = await response.json();
      if (result.success) {
        setPosts(prev => prev.map(p =>
          p.id === post.id
            ? { ...p, status: newStatus, published_at: newStatus === 'published' ? Math.floor(Date.now() / 1000) : null }
            : p
        ));
      }
    } catch (error) {
      console.error('Failed to toggle publish status:', error);
    }
  };

  const savePost = async () => {
    if (!editingPost) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const isNew = !editingPost.id;
      const response = await fetch(
        isNew ? '/api/admin/posts' : `/api/admin/posts/${editingPost.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingPost)
        }
      );
      const result = await response.json();

      if (result.success) {
        setSaveMessage({ type: 'success', text: isNew ? 'Post created successfully!' : 'Post saved successfully!' });
        if (isNew) {
          setPosts(prev => [result.data, ...prev]);
        } else {
          setPosts(prev => prev.map(p => p.id === editingPost.id ? result.data : p));
        }
        setTimeout(() => {
          setShowEditor(false);
          setEditingPost(null);
          setSaveMessage(null);
        }, 1500);
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save post' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save post' });
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = (post: Post) => {
    setPreviewPost(post);
    setShowPreview(true);
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch =
      post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.slug?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || post.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || post.category === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      published: 'bg-green-500/20 text-green-400 border-green-500/50',
      archived: 'bg-amber-500/20 text-amber-400 border-amber-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[status] || colors.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const createNewPost = (): Post => ({
    id: '',
    slug: '',
    title: '',
    excerpt: null,
    content: null,
    category: null,
    status: 'draft',
    author: null,
    published_at: null,
    scheduled_for: null,
    view_count: 0,
    featured: false,
    created_at: Date.now() / 1000,
    updated_at: Date.now() / 1000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Toast Hub Content
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {posts.length} posts, {posts.filter(p => p.status === 'published').length} published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/#/toast-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
            title="View public Toast Hub page"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">View Public Page</span>
          </a>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingPost(createNewPost());
              setShowEditor(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-3">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className={`admin-card p-4 hover:border-gray-600 transition-all ${
              post.status === 'published' ? 'border-l-2 border-l-green-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {post.featured && (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  )}
                  <h3 className="text-white font-semibold truncate">
                    {post.title || 'Untitled'}
                  </h3>
                  {getStatusBadge(post.status)}
                </div>

                <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                  {post.excerpt || 'No excerpt'}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.status === 'published' ? `Published ${formatDate(post.published_at)}` :
                     post.status === 'scheduled' ? `Scheduled ${formatDate(post.scheduled_for)}` :
                     `Created ${formatDate(post.created_at)}`}
                  </span>
                  {post.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {post.category}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {post.view_count} views
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Publish Toggle */}
                <button
                  onClick={() => togglePublished(post)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    post.status === 'published'
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                  title={post.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                >
                  {post.status === 'published' ? (
                    <>
                      <ToggleRight className="w-4 h-4" />
                      <span className="hidden sm:inline">Live</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Draft</span>
                    </>
                  )}
                </button>

                {/* Featured Toggle */}
                <button
                  onClick={() => toggleFeatured(post)}
                  className={`p-2 rounded-lg transition-colors ${
                    post.featured
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-500 hover:text-white hover:bg-gray-700'
                  }`}
                  title={post.featured ? 'Remove from featured' : 'Mark as featured'}
                >
                  <Star className={`w-4 h-4 ${post.featured ? 'fill-current' : ''}`} />
                </button>

                {/* Preview */}
                <button
                  onClick={() => openPreview(post)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Preview"
                >
                  <Monitor className="w-4 h-4" />
                </button>

                {/* Edit */}
                <button
                  onClick={() => {
                    setEditingPost(post);
                    setShowEditor(true);
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* View Live */}
                {post.status === 'published' && (
                  <a
                    href={`/#/toast-hub/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="View live"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Delete */}
                <button
                  onClick={() => deletePost(post.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="admin-card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Posts Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
              ? 'Try adjusting your filters'
              : 'Start creating content for Toast Hub'}
          </p>
          {!searchQuery && filterStatus === 'all' && filterCategory === 'all' && (
            <button
              onClick={() => {
                setEditingPost(createNewPost());
                setShowEditor(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Post
            </button>
          )}
        </div>
      )}

      {/* Categories Section */}
      <section className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            Categories
          </h3>
          <button className="text-amber-400 hover:text-amber-300 text-sm">
            Manage Categories
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                cat.is_active
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-900 border-gray-800 text-gray-500'
              }`}
            >
              {cat.name}
              <span className="ml-2 text-xs text-gray-500">
                ({posts.filter(p => p.category === cat.slug).length})
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Post Editor Modal */}
      {showEditor && editingPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingPost.id ? 'Edit Post' : 'New Post'}
              </h3>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingPost(null);
                  setSaveMessage(null);
                }}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Save Message */}
              {saveMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  saveMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}>
                  {saveMessage.type === 'success' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {saveMessage.text}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-2">Title *</label>
                <input
                  type="text"
                  value={editingPost.title}
                  onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Post title"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Slug (URL path)</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">/toast-hub/</span>
                  <input
                    type="text"
                    value={editingPost.slug}
                    onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="post-url-slug"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Excerpt (for cards and SEO)</label>
                <textarea
                  value={editingPost.excerpt || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Brief description for search results and cards..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Content (Markdown)</label>
                <textarea
                  value={editingPost.content || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Write your content in markdown..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select
                    value={editingPost.category || ''}
                    onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value || null })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="">No category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Status</label>
                  <select
                    value={editingPost.status}
                    onChange={(e) => setEditingPost({ ...editingPost, status: e.target.value as any })}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setEditingPost({ ...editingPost, featured: !editingPost.featured })}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      editingPost.featured ? 'bg-amber-500' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                      editingPost.featured ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-sm text-gray-300">Featured post</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex items-center justify-between">
              <button
                onClick={() => openPreview(editingPost)}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Monitor className="w-4 h-4" />
                Preview
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingPost(null);
                    setSaveMessage(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={savePost}
                  disabled={isSaving || !editingPost.title}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewPost && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Preview Header */}
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-gray-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Preview Mode</h3>
                  <p className="text-xs text-gray-500">
                    This is how the post will appear on the public Toast Hub
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewPost(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <article className="max-w-3xl mx-auto">
                {/* Category Badge */}
                {previewPost.category && (
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider rounded-full mb-4">
                    {categories.find(c => c.slug === previewPost.category)?.name || previewPost.category}
                  </span>
                )}

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                  {previewPost.title || 'Untitled Post'}
                </h1>

                {/* Meta */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b border-gray-200">
                  {previewPost.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(previewPost.published_at)}
                    </span>
                  )}
                  {previewPost.view_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {previewPost.view_count} views
                    </span>
                  )}
                  {previewPost.featured && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      Featured
                    </span>
                  )}
                </div>

                {/* Excerpt */}
                {previewPost.excerpt && (
                  <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                    {previewPost.excerpt}
                  </p>
                )}

                {/* Content */}
                <div className="prose prose-lg max-w-none">
                  {previewPost.content ? (
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {previewPost.content}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No content yet...</p>
                  )}
                </div>
              </article>
            </div>

            {/* Preview Footer */}
            <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Status: <span className={`font-medium ${
                  previewPost.status === 'published' ? 'text-green-600' :
                  previewPost.status === 'draft' ? 'text-gray-600' :
                  'text-amber-600'
                }`}>{previewPost.status}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewPost(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Close Preview
                </button>
                {previewPost.status === 'published' && previewPost.slug && (
                  <a
                    href={`/#/toast-hub/${previewPost.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Live
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToastHubManager;
