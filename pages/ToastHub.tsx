import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText, Calendar, Eye, Star, ChevronRight, Search,
  BookOpen, Lightbulb, TrendingUp, Newspaper, Loader2, ArrowRight,
  Mail, Check, AlertCircle, Zap, Award, Users, Globe, ChevronDown,
  Sparkles, Target, BarChart3, Shield
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

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
  view_count: number;
  featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  tags_json: string | null;
  // Authority Engine fields
  visible_public?: number;
  visible_client_portal?: number;
  visible_rep_portal?: number;
  authority_score?: number;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
}

// Category configuration with icons and gradients
const categoryConfig: Record<string, { icon: React.ElementType; gradient: string; label: string }> = {
  tips: { icon: Lightbulb, gradient: 'from-amber-500 to-orange-600', label: 'Pro Tips' },
  guides: { icon: BookOpen, gradient: 'from-blue-500 to-indigo-600', label: 'Guides' },
  'case-studies': { icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600', label: 'Case Studies' },
  news: { icon: Newspaper, gradient: 'from-purple-500 to-pink-600', label: 'Industry News' },
  updates: { icon: Zap, gradient: 'from-red-500 to-orange-600', label: 'Updates' },
  troubleshooting: { icon: Target, gradient: 'from-rose-500 to-red-600', label: 'Troubleshooting' },
  'menu-engineering': { icon: BarChart3, gradient: 'from-cyan-500 to-blue-600', label: 'Menu Engineering' },
  operations: { icon: Shield, gradient: 'from-slate-500 to-zinc-600', label: 'Operations' },
};

// Animated counter hook
const useAnimatedCounter = (target: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  const animate = useCallback(() => {
    if (hasAnimated) return;
    setHasAnimated(true);

    const startTime = Date.now();
    const step = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      setCount(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, hasAnimated]);

  return { count, animate };
};

const ToastHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterName, setNewsletterName] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Animated stats
  const articlesCounter = useAnimatedCounter(posts.length || 50);
  const viewsCounter = useAnimatedCounter(posts.reduce((acc, p) => acc + p.view_count, 0) || 12500);
  const yearsCounter = useAnimatedCounter(10);

  useSEO({
    title: 'Toast Hub | The Authority Engine for Toast POS | R&G Consulting',
    description: 'The definitive Toast POS knowledge base. Expert guides, operational intelligence, and industry insights curated by certified Toast consultants. Optimized for AI search.',
    canonical: 'https://ccrestaurantconsulting.com/#/toast-hub',
  });

  // Parallax scroll handler
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observer for stats animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            articlesCounter.animate();
            viewsCounter.animate();
            yearsCounter.animate();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [articlesCounter, viewsCounter, yearsCounter]);

  // Enhanced structured data for GEO
  useEffect(() => {
    const blogSchema = {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "Toast Hub - The Authority Engine for Toast POS",
      "description": "The definitive knowledge base for Toast POS systems. Expert guides, operational intelligence, and industry insights curated by certified Toast consultants.",
      "url": "https://ccrestaurantconsulting.com/#/toast-hub",
      "publisher": {
        "@type": "Organization",
        "name": "R&G Consulting LLC",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ccrestaurantconsulting.com/logo.png"
        }
      },
      "author": {
        "@type": "Person",
        "name": "Evan Ramirez",
        "jobTitle": "Restaurant Technology Consultant",
        "worksFor": {
          "@type": "Organization",
          "name": "R&G Consulting LLC"
        }
      },
      "inLanguage": "en-US",
      "blogPost": posts.filter(p => p.status === 'published').slice(0, 10).map(post => ({
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.excerpt || post.meta_description,
        "datePublished": post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined,
        "author": {
          "@type": "Person",
          "name": post.author || "Evan Ramirez",
          "jobTitle": "Restaurant Technology Consultant"
        },
        "url": `https://ccrestaurantconsulting.com/#/toast-hub/${post.slug}`
      }))
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    document.querySelectorAll('script[data-schema="toast-hub"]').forEach(el => el.remove());

    const blogScript = document.createElement('script');
    blogScript.type = 'application/ld+json';
    blogScript.setAttribute('data-schema', 'toast-hub');
    blogScript.textContent = JSON.stringify(blogSchema);
    document.head.appendChild(blogScript);

    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-schema', 'toast-hub');
    faqScript.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    return () => {
      document.querySelectorAll('script[data-schema="toast-hub"]').forEach(el => el.remove());
    };
  }, [posts, faqs]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCategory !== 'all') {
      setSearchParams({ category: selectedCategory });
    } else {
      setSearchParams({});
    }
  }, [selectedCategory, setSearchParams]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [postsRes, categoriesRes, faqsRes] = await Promise.all([
        fetch('/api/toast-hub/posts'),
        fetch('/api/toast-hub/categories'),
        fetch('/api/toast-hub/faqs')
      ]);

      const postsResult = await postsRes.json();
      const categoriesResult = await categoriesRes.json();
      const faqsResult = await faqsRes.json();

      if (postsResult.success) {
        setPosts(postsResult.data?.filter((p: Post) => p.status === 'published') || []);
      }
      if (categoriesResult.success) {
        setCategories(categoriesResult.data?.filter((c: Category) => c.is_active) || []);
      }
      if (faqsResult.success) {
        setFaqs(faqsResult.data || []);
      }
    } catch (error) {
      console.error('Failed to load Toast Hub data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch =
      !searchQuery ||
      post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredPosts = filteredPosts.filter(p => p.featured).slice(0, 3);
  const regularPosts = filteredPosts.filter(p => !p.featured);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryConfig = (slug: string | null) => {
    if (!slug) return { icon: FileText, gradient: 'from-gray-500 to-gray-600', label: 'General' };
    return categoryConfig[slug] || { icon: FileText, gradient: 'from-gray-500 to-gray-600', label: slug };
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;

    setNewsletterStatus('loading');
    try {
      const res = await fetch('/api/toast-hub/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newsletterEmail,
          first_name: newsletterName || undefined,
          source: 'toast_hub_authority_engine'
        })
      });
      const data = await res.json();

      if (data.success) {
        setNewsletterStatus('success');
        setNewsletterMessage(data.message);
        setNewsletterEmail('');
        setNewsletterName('');
        setTimeout(() => {
          setNewsletterStatus('idle');
          setNewsletterMessage('');
        }, 5000);
      } else {
        setNewsletterStatus('error');
        setNewsletterMessage(data.error || 'Subscription failed');
      }
    } catch {
      setNewsletterStatus('error');
      setNewsletterMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0f] overflow-x-hidden">
      {/* Cinematic Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234, 88, 12, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(251, 191, 36, 0.15) 0%, transparent 40%),
              radial-gradient(ellipse 40% 30% at 20% 80%, rgba(234, 88, 12, 0.1) 0%, transparent 30%)
            `,
            transform: `translateY(${scrollY * 0.3}px)`
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Floating geometric elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-20 left-[10%] w-64 h-64 border border-amber-500/10 rounded-full"
            style={{ transform: `translateY(${scrollY * 0.1}px) rotate(${scrollY * 0.02}deg)` }}
          />
          <div
            className="absolute bottom-40 right-[15%] w-96 h-96 border border-orange-500/5 rounded-full"
            style={{ transform: `translateY(${-scrollY * 0.15}px) rotate(${-scrollY * 0.01}deg)` }}
          />
          <div
            className="absolute top-1/3 right-[20%] w-3 h-3 bg-amber-500/30 rounded-full blur-sm"
            style={{ transform: `translateY(${scrollY * 0.2}px)` }}
          />
          <div
            className="absolute bottom-1/3 left-[25%] w-2 h-2 bg-orange-500/40 rounded-full blur-sm"
            style={{ transform: `translateY(${-scrollY * 0.25}px)` }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8"
            style={{
              animation: 'fadeInUp 0.8s ease-out forwards',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium tracking-wide">THE AUTHORITY ENGINE</span>
          </div>

          {/* Main headline */}
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              animation: 'fadeInUp 0.8s ease-out 0.1s forwards',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            Toast<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500">Hub</span>
          </h1>

          {/* Decorative line */}
          <div
            className="w-24 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mb-8"
            style={{
              animation: 'scaleIn 0.6s ease-out 0.3s forwards',
              opacity: 0,
              transform: 'scaleX(0)'
            }}
          />

          {/* Subtitle */}
          <p
            className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              animation: 'fadeInUp 0.8s ease-out 0.2s forwards',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            The definitive knowledge base for Toast POS. Expert operational intelligence,
            industry insights, and actionable guides curated by certified consultants.
          </p>

          {/* Stats row */}
          <div
            ref={statsRef}
            className="flex flex-wrap justify-center gap-8 md:gap-16 mb-12"
            style={{
              animation: 'fadeInUp 0.8s ease-out 0.4s forwards',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {articlesCounter.count}+
              </div>
              <div className="text-zinc-500 text-sm uppercase tracking-wider">Articles</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {viewsCounter.count.toLocaleString()}+
              </div>
              <div className="text-zinc-500 text-sm uppercase tracking-wider">Views</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {yearsCounter.count}+
              </div>
              <div className="text-zinc-500 text-sm uppercase tracking-wider">Years Expertise</div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-500"
            style={{
              animation: 'fadeInUp 0.8s ease-out 0.6s forwards, bounce 2s ease-in-out infinite 1.4s',
              opacity: 0,
              transform: 'translateY(20px)'
            }}
          >
            <span className="text-xs uppercase tracking-widest">Explore</span>
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Glass Search Bar - Floating */}
      <div className="sticky top-0 z-50 py-4 transition-all duration-300" style={{
        backgroundColor: scrollY > 100 ? 'rgba(12, 12, 15, 0.95)' : 'transparent',
        backdropFilter: scrollY > 100 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 100 ? '1px solid rgba(255,255,255,0.05)' : 'none'
      }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className={`relative transition-all duration-300 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 transition-opacity duration-300" style={{ opacity: isSearchFocused ? 0.5 : 0 }} />
            <div className="relative flex items-center gap-4 px-6 py-4 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl">
              <Search className="w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search the knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-lg"
                style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700'
            }`}
          >
            All Topics
          </button>
          {categories.map(cat => {
            const config = getCategoryConfig(cat.slug);
            const Icon = config.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  selectedCategory === cat.slug
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-zinc-800 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
            </div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-900 flex items-center justify-center">
              <FileText className="w-10 h-10 text-zinc-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              No Articles Found
            </h2>
            <p className="text-zinc-500 mb-6">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search or category filter'
                : 'New content is being curated. Check back soon!'}
            </p>
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured Bento Grid */}
            {featuredPosts.length > 0 && (
              <section className="mb-16">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Featured Intelligence
                    </h2>
                    <p className="text-zinc-500 text-sm">Curated insights from our experts</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredPosts.map((post, idx) => {
                    const config = getCategoryConfig(post.category);
                    const Icon = config.icon;
                    return (
                      <Link
                        key={post.id}
                        to={`/toast-hub/${post.slug}`}
                        className={`group relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-amber-500/30 transition-all duration-500 ${
                          idx === 0 ? 'md:col-span-2 md:row-span-2' : ''
                        }`}
                        style={{
                          animationDelay: `${idx * 0.1}s`
                        }}
                      >
                        {/* Gradient overlay */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                        <div className={`relative p-6 ${idx === 0 ? 'md:p-10' : ''} h-full flex flex-col`}>
                          {/* Category badge */}
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-zinc-400 text-sm font-medium">{config.label}</span>
                            {post.featured && (
                              <span className="ml-auto flex items-center gap-1 text-amber-500 text-xs">
                                <Star className="w-3 h-3 fill-current" />
                                Featured
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className={`font-bold text-white mb-3 group-hover:text-amber-400 transition-colors ${
                            idx === 0 ? 'text-2xl md:text-3xl' : 'text-xl'
                          }`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {post.title}
                          </h3>

                          {/* Excerpt */}
                          <p className={`text-zinc-400 mb-6 flex-grow ${idx === 0 ? 'text-lg line-clamp-4' : 'line-clamp-2'}`}>
                            {post.excerpt || 'Discover expert insights on this topic...'}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                            <div className="flex items-center gap-4 text-sm text-zinc-500">
                              {post.published_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(post.published_at)}
                                </span>
                              )}
                              {post.view_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  {post.view_count.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* All Articles Grid */}
            {regularPosts.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Knowledge Base
                    </h2>
                    <p className="text-zinc-500 text-sm">{regularPosts.length} articles available</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularPosts.map((post, idx) => {
                    const config = getCategoryConfig(post.category);
                    const Icon = config.icon;
                    return (
                      <Link
                        key={post.id}
                        to={`/toast-hub/${post.slug}`}
                        className="group relative overflow-hidden rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 transition-all duration-300 hover:transform hover:-translate-y-1"
                        style={{
                          animation: 'fadeInUp 0.5s ease-out forwards',
                          animationDelay: `${idx * 0.05}s`,
                          opacity: 0
                        }}
                      >
                        <div className="p-5">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center opacity-80`}>
                              <Icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{config.label}</span>
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors line-clamp-2">
                            {post.title}
                          </h3>

                          {/* Excerpt */}
                          <p className="text-zinc-500 text-sm line-clamp-2 mb-4">
                            {post.excerpt || 'Read more about this topic...'}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center justify-between text-xs text-zinc-600">
                            <div className="flex items-center gap-3">
                              {post.published_at && (
                                <span>{formatDate(post.published_at)}</span>
                              )}
                              {post.view_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {post.view_count}
                                </span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <section className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Frequently Asked Questions
              </h2>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mb-4" />
              <p className="text-zinc-400">Common questions about Toast POS answered by our experts</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq, idx) => (
                <div
                  key={faq.id}
                  className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50"
                  style={{
                    animation: 'fadeInUp 0.5s ease-out forwards',
                    animationDelay: `${idx * 0.05}s`,
                    opacity: 0
                  }}
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <h3 className="text-lg font-medium text-white">{faq.question}</h3>
                    <ChevronRight className={`w-5 h-5 text-zinc-500 transition-transform duration-300 flex-shrink-0 ${
                      expandedFaq === faq.id ? 'rotate-90' : ''
                    }`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${
                    expandedFaq === faq.id ? 'max-h-96' : 'max-h-0'
                  }`}>
                    <div className="px-6 pb-5">
                      <p className="text-zinc-400 leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Newsletter Section */}
        <section className="mt-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-3xl" />

            <div className="relative px-8 py-12 md:px-16 md:py-16">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-sm font-medium">Intelligence Brief</span>
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Weekly Toast Insights
                </h2>
                <p className="text-zinc-400 mb-8">
                  Get curated intelligence, industry updates, and actionable tips delivered every Tuesday.
                </p>

                {newsletterStatus === 'success' ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
                    <Check className="w-6 h-6" />
                    <span className="font-medium">{newsletterMessage}</span>
                  </div>
                ) : (
                  <form onSubmit={handleNewsletterSubmit} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                      <input
                        type="text"
                        placeholder="First name"
                        value={newsletterName}
                        onChange={(e) => setNewsletterName(e.target.value)}
                        className="flex-1 px-5 py-3.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      />
                      <input
                        type="email"
                        placeholder="Email address"
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        required
                        className="flex-[2] px-5 py-3.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={newsletterStatus === 'loading' || !newsletterEmail}
                      className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                    >
                      {newsletterStatus === 'loading' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>Subscribe</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {newsletterStatus === 'error' && (
                      <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{newsletterMessage}</span>
                      </div>
                    )}

                    <p className="text-xs text-zinc-600">
                      No spam. Unsubscribe anytime. We respect your inbox.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-24">
          <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0c] border border-zinc-800">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />

            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Need Expert Toast Guidance?
              </h2>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mb-6" />
              <p className="text-zinc-400 max-w-2xl mx-auto mb-10 text-lg">
                From initial setup to ongoing optimization, our certified Toast consultants help your restaurant maximize technology investment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/schedule"
                  className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all gap-2"
                >
                  Schedule Free Consultation
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all"
                >
                  View Support Plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CSS Animations */}
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

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scaleX(0);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
};

export default ToastHub;
