import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Calendar, Eye, Star, ArrowLeft, Tag, ChevronRight,
  Loader2, Share2, Bookmark, Clock
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_format: string | null;
  category: string | null;
  author: string | null;
  published_at: number | null;
  view_count: number;
  featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  tags_json: string | null;
  relatedPosts?: RelatedPost[];
}

interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  published_at: number | null;
  featured: boolean;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

const ToastHubPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic SEO based on post data
  useSEO({
    title: post?.meta_title || post?.title
      ? `${post?.meta_title || post?.title} | Toast Hub | R&G Consulting`
      : 'Toast Hub | R&G Consulting',
    description: post?.meta_description || post?.excerpt || 'Expert Toast POS guides, tips, and resources.',
    canonical: `https://ccrestaurantconsulting.com/#/toast-hub/${slug}`,
  });

  // Inject structured data for the article
  useEffect(() => {
    if (!post) return;

    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.excerpt || post.meta_description,
      "datePublished": post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined,
      "author": {
        "@type": "Person",
        "name": post.author || "R&G Consulting"
      },
      "publisher": {
        "@type": "Organization",
        "name": "R&G Consulting LLC",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ccrestaurantconsulting.com/logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://ccrestaurantconsulting.com/#/toast-hub/${slug}`
      },
      "image": post.og_image_url || undefined
    };

    // BreadcrumbList schema
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://ccrestaurantconsulting.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Toast Hub",
          "item": "https://ccrestaurantconsulting.com/#/toast-hub"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": post.title,
          "item": `https://ccrestaurantconsulting.com/#/toast-hub/${slug}`
        }
      ]
    };

    // Remove existing schemas
    document.querySelectorAll('script[data-schema="toast-hub-post"]').forEach(el => el.remove());

    // Add article schema
    const articleScript = document.createElement('script');
    articleScript.type = 'application/ld+json';
    articleScript.setAttribute('data-schema', 'toast-hub-post');
    articleScript.textContent = JSON.stringify(articleSchema);
    document.head.appendChild(articleScript);

    // Add breadcrumb schema
    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-schema', 'toast-hub-post');
    breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbScript);

    return () => {
      document.querySelectorAll('script[data-schema="toast-hub-post"]').forEach(el => el.remove());
    };
  }, [post, slug]);

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [postRes, categoriesRes] = await Promise.all([
        fetch(`/api/toast-hub/${slug}`),
        fetch('/api/toast-hub/categories')
      ]);

      const postResult = await postRes.json();
      const categoriesResult = await categoriesRes.json();

      if (!postResult.success) {
        setError(postResult.error || 'Post not found');
        return;
      }

      setPost(postResult.data);
      if (categoriesResult.success) {
        setCategories(categoriesResult.data || []);
      }
    } catch (err) {
      console.error('Failed to load post:', err);
      setError('Failed to load article');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryName = (slug: string | null) => {
    if (!slug) return 'General';
    const cat = categories.find(c => c.slug === slug);
    return cat?.name || slug;
  };

  const estimateReadTime = (content: string | null) => {
    if (!content) return 1;
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt || '',
          url
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    // Convert basic markdown patterns
    let html = content
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-4">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-10 mb-6">$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
      // Paragraphs (lines with content)
      .replace(/^(?!<[h|l])(.+)$/gm, '<p class="mb-4 leading-relaxed">$1</p>')
      // Line breaks
      .replace(/\n\n/g, '');

    return html;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Article Not Found</h1>
        <p className="text-gray-600 mb-6">{error || 'The article you are looking for does not exist.'}</p>
        <Link
          to="/toast-hub"
          className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-600 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Toast Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-primary-dark py-12 pt-8 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/toast-hub" className="hover:text-white transition-colors">Toast Hub</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-300 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* Category */}
          {post.category && (
            <Link
              to={`/toast-hub?category=${post.category}`}
              className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-4 hover:bg-amber-500/30 transition-colors"
            >
              {getCategoryName(post.category)}
            </Link>
          )}

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            {post.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(post.published_at)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {estimateReadTime(post.content)} min read
            </span>
            {post.view_count > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.view_count} views
              </span>
            )}
            {post.featured && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-4 h-4 fill-current" />
                Featured
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <article className="flex-1 min-w-0">
            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-xl text-gray-600 mb-8 leading-relaxed border-l-4 border-amber-500 pl-4 italic">
                {post.excerpt}
              </p>
            )}

            {/* Content */}
            <div
              className="prose prose-lg max-w-none prose-headings:font-display prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: renderContent(post.content || '') }}
            />

            {/* Share and Actions */}
            <div className="mt-12 pt-8 border-t border-gray-200 flex items-center justify-between">
              <Link
                to="/toast-hub"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-amber-500 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Toast Hub
              </Link>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:w-72 flex-shrink-0">
            <div className="sticky top-24 space-y-8">
              {/* Author Card */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">About the Author</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {(post.author || 'R')[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{post.author || 'R&G Consulting'}</p>
                    <p className="text-sm text-gray-500">Toast POS Expert</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Certified Toast consultant with 10+ years in restaurant operations and technology.
                </p>
              </div>

              {/* Related Posts */}
              {post.relatedPosts && post.relatedPosts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Related Articles</h3>
                  <div className="space-y-4">
                    {post.relatedPosts.map(related => (
                      <Link
                        key={related.id}
                        to={`/toast-hub/${related.slug}`}
                        className="block group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                          <div>
                            <h4 className="text-gray-900 font-medium group-hover:text-amber-500 transition-colors line-clamp-2 text-sm">
                              {related.title}
                            </h4>
                            {related.category && (
                              <span className="text-xs text-gray-500">{getCategoryName(related.category)}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Card */}
              <div className="bg-primary-dark rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">Need Toast POS Help?</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Get expert guidance from certified Toast consultants.
                </p>
                <Link
                  to="/schedule"
                  className="block w-full text-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Schedule Free Call
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* CTA Section */}
      <section className="bg-gray-50 border-t border-gray-200 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Ready to Optimize Your Toast POS?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            From initial setup to ongoing support, our certified Toast consultants are here to help your restaurant succeed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Schedule Free Consultation
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:bg-gray-100 border border-gray-300"
              style={{ backgroundColor: '#ffffff', color: '#111827' }}
            >
              View Support Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ToastHubPost;
