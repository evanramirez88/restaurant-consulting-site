import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FileText, Calendar, Eye, Star, ArrowLeft, ChevronRight,
  Loader2, Share2, Clock, Bookmark, BookmarkCheck, Quote,
  Lightbulb, ArrowUp, ExternalLink, MessageSquare, Users, Globe
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
  // Authority Engine fields
  visible_public?: number;
  visible_client_portal?: number;
  visible_rep_portal?: number;
  authority_score?: number;
  ai_summary?: string;
  expert_commentary?: string;
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

// Category configuration
const categoryConfig: Record<string, { gradient: string; label: string }> = {
  tips: { gradient: 'from-amber-500 to-orange-600', label: 'Pro Tips' },
  guides: { gradient: 'from-blue-500 to-indigo-600', label: 'Guides' },
  'case-studies': { gradient: 'from-emerald-500 to-teal-600', label: 'Case Studies' },
  news: { gradient: 'from-purple-500 to-pink-600', label: 'Industry News' },
  updates: { gradient: 'from-red-500 to-orange-600', label: 'Updates' },
  troubleshooting: { gradient: 'from-rose-500 to-red-600', label: 'Troubleshooting' },
  'menu-engineering': { gradient: 'from-cyan-500 to-blue-600', label: 'Menu Engineering' },
  operations: { gradient: 'from-slate-500 to-zinc-600', label: 'Operations' },
};

const ToastHubPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const articleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Dynamic SEO
  useSEO({
    title: post?.meta_title || post?.title
      ? `${post?.meta_title || post?.title} | Restaurant Wrap | R&G Consulting`
      : 'Restaurant Wrap | R&G Consulting',
    description: post?.meta_description || post?.excerpt || 'Expert restaurant technology guides, tips, and resources from certified consultants.',
    canonical: `https://ccrestaurantconsulting.com/#/toast-hub/${slug}`,
  });

  // Reading progress and scroll effects
  useEffect(() => {
    const handleScroll = () => {
      if (!articleRef.current) return;

      const article = articleRef.current;
      const articleTop = article.offsetTop;
      const articleHeight = article.offsetHeight;
      const scrollPosition = window.scrollY - articleTop + window.innerHeight / 2;
      const progress = Math.max(0, Math.min(100, (scrollPosition / articleHeight) * 100));

      setReadingProgress(progress);
      setShowBackToTop(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Enhanced structured data for GEO (Article + FAQPage combined)
  useEffect(() => {
    if (!post) return;

    // Article schema with enhanced author info
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": post.excerpt || post.meta_description,
      "datePublished": post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined,
      "author": {
        "@type": "Person",
        "name": post.author || "Evan Ramirez",
        "jobTitle": "Restaurant Technology Consultant",
        "worksFor": {
          "@type": "Organization",
          "name": "R&G Consulting LLC"
        }
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
      "image": post.og_image_url || undefined,
      // GEO optimization: Include FAQ even in articles
      "mainEntity": {
        "@type": "FAQPage",
        "mainEntity": extractFAQsFromContent(post.content || '')
      }
    };

    // Breadcrumb schema
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
          "name": "Restaurant Wrap",
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

    document.querySelectorAll('script[data-schema="restaurant-wrap-post"]').forEach(el => el.remove());

    const articleScript = document.createElement('script');
    articleScript.type = 'application/ld+json';
    articleScript.setAttribute('data-schema', 'toast-hub-post');
    articleScript.textContent = JSON.stringify(articleSchema);
    document.head.appendChild(articleScript);

    const breadcrumbScript = document.createElement('script');
    breadcrumbScript.type = 'application/ld+json';
    breadcrumbScript.setAttribute('data-schema', 'toast-hub-post');
    breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbScript);

    return () => {
      document.querySelectorAll('script[data-schema="restaurant-wrap-post"]').forEach(el => el.remove());
    };
  }, [post, slug]);

  // Extract FAQs from headers for schema
  const extractFAQsFromContent = (content: string): Array<{
    "@type": "Question";
    "name": string;
    "acceptedAnswer": { "@type": "Answer"; "text": string };
  }> => {
    const faqs: Array<{
      "@type": "Question";
      "name": string;
      "acceptedAnswer": { "@type": "Answer"; "text": string };
    }> = [];
    const lines = content.split('\n');
    let currentQuestion = '';
    let currentAnswer = '';

    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentQuestion && currentAnswer) {
          faqs.push({
            "@type": "Question",
            "name": currentQuestion,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": currentAnswer.trim()
            }
          });
        }
        currentQuestion = line.replace(/^#+\s+/, '');
        currentAnswer = '';
      } else if (currentQuestion && line.trim()) {
        currentAnswer += line + ' ';
      }
    }

    if (currentQuestion && currentAnswer) {
      faqs.push({
        "@type": "Question",
        "name": currentQuestion,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentAnswer.trim()
        }
      });
    }

    return faqs.slice(0, 5);
  };

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
        setError(postResult.error || 'Article not found');
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

  const getCategoryConfig = (slug: string | null) => {
    if (!slug) return { gradient: 'from-gray-500 to-gray-600', label: 'General' };
    return categoryConfig[slug] || { gradient: 'from-gray-500 to-gray-600', label: slug };
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
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // Could persist to localStorage or API
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate TL;DR from excerpt or first paragraph
  const getTLDR = () => {
    if (post?.ai_summary) return post.ai_summary;
    if (post?.excerpt) return post.excerpt;
    if (post?.content) {
      const firstPara = post.content.split('\n\n')[0];
      return firstPara.replace(/^#+\s+/, '').substring(0, 200) + '...';
    }
    return '';
  };

  // Enhanced content rendering with GEO features
  const renderContent = (content: string) => {
    // Process content with enhanced styling
    let html = content
      // Headers with anchor IDs
      .replace(/^### (.+)$/gm, (_, title) => {
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<h3 id="${id}" class="text-xl font-bold text-white mt-12 mb-4 scroll-mt-24 group">
          <a href="#${id}" class="hover:text-amber-400 transition-colors">${title}</a>
        </h3>`;
      })
      .replace(/^## (.+)$/gm, (_, title) => {
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<h2 id="${id}" class="text-2xl font-bold text-white mt-14 mb-5 scroll-mt-24 group" style="font-family: 'Playfair Display', Georgia, serif">
          <a href="#${id}" class="hover:text-amber-400 transition-colors">${title}</a>
        </h2>`;
      })
      .replace(/^# (.+)$/gm, (_, title) => {
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<h1 id="${id}" class="text-3xl font-bold text-white mt-14 mb-6 scroll-mt-24" style="font-family: 'Playfair Display', Georgia, serif">${title}</h1>`;
      })
      // Bold for statistics (GEO: highlight data points)
      .replace(/\*\*(\d+[%\+\-]?[^\*]*)\*\*/g, '<strong class="text-amber-400 font-bold">$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-zinc-300">$1</em>')
      // Blockquotes as pull quotes
      .replace(/^>\s*(.+)$/gm, `
        <blockquote class="my-8 pl-6 border-l-4 border-amber-500 bg-zinc-900/50 py-4 pr-6 rounded-r-lg">
          <p class="text-xl text-zinc-300 italic leading-relaxed">$1</p>
        </blockquote>
      `)
      // Lists
      .replace(/^- (.+)$/gm, '<li class="flex items-start gap-3 mb-2"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2.5 flex-shrink-0"></span><span class="text-zinc-300">$1</span></li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start gap-3 mb-2"><span class="text-amber-500 font-bold min-w-[1.5rem]">$1.</span><span class="text-zinc-300">$2</span></li>')
      // Paragraphs
      .replace(/^(?!<[h|l|b])(.+)$/gm, '<p class="text-zinc-300 mb-6 leading-relaxed text-lg">$1</p>')
      .replace(/\n\n/g, '');

    return html;
  };

  // Extract section headings for TOC
  const extractHeadings = (content: string): Array<{ id: string; title: string; level: number }> => {
    const headings: Array<{ id: string; title: string; level: number }> = [];
    const regex = /^(#{2,3})\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2];
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      headings.push({ id, title, level });
    }
    return headings;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-zinc-800 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-zinc-600" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Article Not Found
        </h1>
        <p className="text-zinc-500 mb-6">{error || 'The article you are looking for does not exist.'}</p>
        <Link
          to="/toast-hub"
          className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Restaurant Wrap
        </Link>
      </div>
    );
  }

  const config = getCategoryConfig(post.category);
  const headings = extractHeadings(post.content || '');
  const tldr = getTLDR();

  return (
    <div className="min-h-screen bg-[#0c0c0f]">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative pt-8 pb-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-[#0c0c0f]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/toast-hub" className="hover:text-white transition-colors">Restaurant Wrap</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-zinc-400 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* Category badge */}
          {post.category && (
            <Link
              to={`/toast-hub?category=${post.category}`}
              className={`inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r ${config.gradient} bg-opacity-20 rounded-full mb-6 text-white text-sm font-medium hover:opacity-80 transition-opacity`}
            >
              {config.label}
            </Link>
          )}

          {/* Title */}
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {post.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-400 mb-8">
            {post.published_at && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(post.published_at)}
              </span>
            )}
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {estimateReadTime(post.content)} min read
            </span>
            {post.view_count > 0 && (
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {post.view_count.toLocaleString()} views
              </span>
            )}
            {post.featured && (
              <span className="flex items-center gap-2 text-amber-400">
                <Star className="w-4 h-4 fill-current" />
                Featured
              </span>
            )}
          </div>

          {/* Visibility badges (for portal integration) */}
          {(post.visible_client_portal || post.visible_rep_portal) && (
            <div className="flex items-center gap-3 mb-8">
              {post.visible_client_portal === 1 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
                  <Users className="w-3 h-3" />
                  Client Resources
                </span>
              )}
              {post.visible_rep_portal === 1 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-medium">
                  <Globe className="w-3 h-3" />
                  Sales Intel
                </span>
              )}
            </div>
          )}

          {/* Author card */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
              {(post.author || 'E')[0]}
            </div>
            <div>
              <p className="text-white font-medium">{post.author || 'Evan Ramirez'}</p>
              <p className="text-zinc-500 text-sm">Restaurant Technology Consultant</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex gap-12">
          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-20 space-y-8">
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-sm"
                >
                  {copiedLink ? (
                    <>
                      <ExternalLink className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Share
                    </>
                  )}
                </button>
                <button
                  onClick={handleBookmark}
                  className={`flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg transition-all text-sm ${
                    isBookmarked ? 'text-amber-400 border-amber-500/30' : 'text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              </div>

              {/* TOC */}
              {headings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">On This Page</h3>
                  <nav className="space-y-2">
                    {headings.map((heading) => (
                      <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={`block text-sm transition-colors ${
                          heading.level === 3 ? 'pl-4' : ''
                        } ${
                          activeSection === heading.id
                            ? 'text-amber-400'
                            : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        {heading.title}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* CTA Card */}
              <div className="p-5 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl">
                <h4 className="text-white font-semibold mb-2">Need Help?</h4>
                <p className="text-zinc-400 text-sm mb-4">Get expert restaurant tech guidance.</p>
                <Link
                  to="/schedule"
                  className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all text-sm"
                >
                  Schedule Call
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <article ref={articleRef} className="flex-1 min-w-0 max-w-3xl">
            {/* TL;DR Block - GEO Optimized */}
            {tldr && (
              <div className="mb-10 p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="text-amber-400 font-semibold text-sm uppercase tracking-wider">TL;DR</span>
                </div>
                <p className="text-lg text-white leading-relaxed font-medium">
                  {tldr}
                </p>
              </div>
            )}

            {/* Main content */}
            <div
              ref={contentRef}
              className="prose-custom"
              dangerouslySetInnerHTML={{ __html: renderContent(post.content || '') }}
            />

            {/* Expert Commentary Section */}
            {post.expert_commentary && (
              <div className="mt-12 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Expert Analysis</h3>
                    <p className="text-zinc-500 text-sm">From our consulting team</p>
                  </div>
                </div>
                <div className="pl-13">
                  <p className="text-zinc-300 leading-relaxed italic">
                    "{post.expert_commentary}"
                  </p>
                  <p className="mt-3 text-zinc-500 text-sm">— {post.author || 'Evan Ramirez'}, R&G Consulting</p>
                </div>
              </div>
            )}

            {/* Related Articles */}
            {post.relatedPosts && post.relatedPosts.length > 0 && (
              <div className="mt-16 pt-12 border-t border-zinc-800">
                <h2 className="text-2xl font-bold text-white mb-8" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Related Articles
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {post.relatedPosts.map(related => {
                    const relConfig = getCategoryConfig(related.category);
                    return (
                      <Link
                        key={related.id}
                        to={`/toast-hub/${related.slug}`}
                        className="group p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                      >
                        <span className={`inline-block px-2 py-0.5 bg-gradient-to-r ${relConfig.gradient} bg-opacity-20 rounded text-xs text-white font-medium mb-3`}>
                          {relConfig.label}
                        </span>
                        <h3 className="text-white font-medium group-hover:text-amber-400 transition-colors line-clamp-2 mb-2">
                          {related.title}
                        </h3>
                        {related.excerpt && (
                          <p className="text-zinc-500 text-sm line-clamp-2">{related.excerpt}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Back link */}
            <div className="mt-12 pt-8 border-t border-zinc-800">
              <Link
                to="/toast-hub"
                className="inline-flex items-center gap-2 text-zinc-400 hover:text-amber-500 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Restaurant Wrap
              </Link>
            </div>
          </article>
        </div>
      </div>

      {/* CTA Section */}
      <section className="border-t border-zinc-800 bg-zinc-900/50 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Ready to Optimize Your Restaurant Technology?
          </h2>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mb-6" />
          <p className="text-zinc-400 max-w-2xl mx-auto mb-10 text-lg">
            From initial setup to ongoing support, our certified consultants help your restaurant succeed with technology.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all gap-2"
            >
              Schedule Free Consultation
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all"
            >
              View Support Plans
            </Link>
          </div>
        </div>
      </section>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:border-amber-500 transition-all shadow-lg z-40"
          style={{
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Custom styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .prose-custom {
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .prose-custom ul {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }

        .prose-custom ol {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
        }
      `}</style>
    </div>
  );
};

export default ToastHubPost;
