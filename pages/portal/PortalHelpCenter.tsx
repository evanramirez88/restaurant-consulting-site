import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, Search, BookOpen, ChevronRight, Tag, ArrowLeft, Eye, X
} from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  tags_json: string | null;
  created_at: number;
  view_count: number;
}

interface Category {
  slug: string;
  name: string;
  description: string;
}

const PortalHelpCenter: React.FC = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  useEffect(() => {
    loadArticles();
  }, [selectedCategory, searchQuery]);

  async function loadArticles() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '50');

      const res = await fetch(`/api/portal/${slug}/knowledge-base?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setArticles(data.data.articles || []);
        if (categories.length === 0) {
          setCategories(data.data.categories || []);
        }
      }
    } catch (e) {
      console.error('Failed to load articles:', e);
    } finally {
      setLoading(false);
    }
  }

  async function openArticle(articleSlug: string) {
    try {
      setLoadingArticle(true);
      const res = await fetch(`/api/portal/${slug}/knowledge-base/${articleSlug}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setSelectedArticle(data.data.article);
      }
    } catch (e) {
      console.error('Failed to load article:', e);
    } finally {
      setLoadingArticle(false);
    }
  }

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Article Detail View
  if (selectedArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </button>

        <article className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
              {selectedArticle.category}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {selectedArticle.view_count} views
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">{selectedArticle.title}</h1>

          {selectedArticle.excerpt && (
            <p className="text-gray-400 text-lg mb-6 border-b border-gray-700 pb-6">
              {selectedArticle.excerpt}
            </p>
          )}

          <div
            className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: selectedArticle.content || '<p>No content available.</p>' }}
          />

          <div className="mt-8 pt-6 border-t border-gray-700 text-xs text-gray-500">
            Last updated: {formatDate(selectedArticle.created_at)}
          </div>
        </article>
      </div>
    );
  }

  // Article List View
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-amber-400" />
          Help Center
        </h1>
        <p className="text-gray-400 mt-1">Find answers to common questions about Toast POS and our services</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !selectedCategory ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === cat.slug ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Articles */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading articles...
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            {searchQuery ? 'No articles found' : 'Help articles coming soon'}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchQuery
              ? 'Try adjusting your search terms or browse by category.'
              : 'Our team is building out the knowledge base. Check back soon or submit a support ticket.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map(article => (
            <button
              key={article.id}
              onClick={() => openArticle(article.slug)}
              className="text-left bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-amber-500/30 hover:bg-gray-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-[11px]">
                      {article.category}
                    </span>
                  </div>
                  <h3 className="font-medium text-white group-hover:text-amber-400 transition-colors mb-1 truncate">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-gray-500 text-sm line-clamp-2">{article.excerpt}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-amber-400 transition-colors flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingArticle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default PortalHelpCenter;
