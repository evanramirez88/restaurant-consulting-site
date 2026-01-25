import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Edit3, Trash2, Eye, Calendar,
  Tag, Loader2, RefreshCw, Star, ExternalLink, ToggleLeft, ToggleRight,
  Globe, HelpCircle, BarChart3
} from 'lucide-react';
import ContentEditor from './ContentEditor';
import FAQManager from './FAQManager';
import ContentAnalytics from './ContentAnalytics';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_format: string;
  category: string | null;
  tags_json: string | null;
  meta_title: string | null;
  meta_description: string | null;
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

type ContentTab = 'articles' | 'faqs' | 'analytics';

const ToastHubManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ContentTab>('articles');
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [postsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/posts', { credentials: 'include' }),
        fetch('/api/admin/categories', { credentials: 'include' })
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
      await fetch(`/api/admin/posts/${id}`, { method: 'DELETE', credentials: 'include' });
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
        credentials: 'include',
        body: JSON.stringify({ ...post, featured: !post.featured })
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
        credentials: 'include',
        body: JSON.stringify({
          ...post,
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

  const handleSavePost = async (postData: Post) => {
    const isNew = !postData.id;
    const response = await fetch(
      isNew ? '/api/admin/posts' : `/api/admin/posts/${postData.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(postData)
      }
    );
    const result = await response.json();
    if (result.success) {
      if (isNew) {
        setPosts(prev => [result.data, ...prev]);
        setEditingPost(result.data);
      } else {
        setPosts(prev => prev.map(p => p.id === postData.id ? result.data : p));
      }
    } else {
      throw new Error(result.error || 'Failed to save');
    }
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
      month: 'short', day: 'numeric', year: 'numeric'
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
    content_format: 'markdown',
    category: null,
    tags_json: null,
    meta_title: null,
    meta_description: null,
    status: 'draft',
    author: null,
    published_at: null,
    scheduled_for: null,
    view_count: 0,
    featured: false,
    created_at: Date.now() / 1000,
    updated_at: Date.now() / 1000
  });

  // If editing a post, show the full-page ContentEditor
  if (editingPost) {
    return (
      <div className="admin-card overflow-hidden">
        <ContentEditor
          post={editingPost}
          categories={categories}
          onSave={handleSavePost}
          onBack={() => { setEditingPost(null); loadData(); }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-Tab Navigation */}
      <div className="admin-card p-2">
        <div className="flex gap-1">
          {[
            { id: 'articles' as ContentTab, label: 'Articles', icon: FileText },
            { id: 'faqs' as ContentTab, label: 'FAQs', icon: HelpCircle },
            { id: 'analytics' as ContentTab, label: 'Analytics', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'faqs' && <FAQManager />}
      {activeTab === 'analytics' && <ContentAnalytics />}
      {activeTab === 'articles' && (
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
                <span className="hidden sm:inline">View Site</span>
              </a>
              <button
                onClick={loadData}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingPost(createNewPost())}
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
                className={`admin-card p-4 hover:border-gray-600 transition-all cursor-pointer ${
                  post.status === 'published' ? 'border-l-2 border-l-green-500' : ''
                }`}
                onClick={() => setEditingPost(post)}
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
                    <p className="text-gray-400 text-sm line-clamp-1 mb-2">
                      {post.excerpt || 'No excerpt'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.status === 'published' ? formatDate(post.published_at) :
                         post.status === 'scheduled' ? formatDate(post.scheduled_for) :
                         formatDate(post.created_at)}
                      </span>
                      {post.category && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {post.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.view_count}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => togglePublished(post)}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        post.status === 'published'
                          ? 'text-green-400 hover:bg-green-500/10'
                          : 'text-gray-500 hover:text-white hover:bg-gray-700'
                      }`}
                      title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                    >
                      {post.status === 'published' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleFeatured(post)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        post.featured ? 'text-amber-400' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${post.featured ? 'fill-current' : ''}`} />
                    </button>
                    {post.status === 'published' && (
                      <a
                        href={`/#/toast-hub/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => deletePost(post.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg"
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
                  onClick={() => setEditingPost(createNewPost())}
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
        </div>
      )}
    </div>
  );
};

export default ToastHubManager;
