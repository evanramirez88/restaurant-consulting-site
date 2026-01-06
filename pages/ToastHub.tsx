import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText, Calendar, Tag, Eye, Star, ChevronRight, Search,
  BookOpen, Lightbulb, TrendingUp, Newspaper, Loader2, ArrowRight
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
}

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

// Category icon mapping
const getCategoryIcon = (slug: string) => {
  switch (slug) {
    case 'tips':
      return Lightbulb;
    case 'guides':
      return BookOpen;
    case 'case-studies':
      return TrendingUp;
    case 'news':
      return Newspaper;
    case 'updates':
      return FileText;
    default:
      return FileText;
  }
};

// FAQ data for SEO schema
const FAQ_DATA = [
  {
    question: "What is Toast POS and why should I consider it for my restaurant?",
    answer: "Toast POS is a cloud-based restaurant point-of-sale system built specifically for the food service industry. It offers integrated payment processing, online ordering, kitchen display systems, and robust reporting. Unlike generic POS systems, Toast understands restaurant workflows like coursing, modifiers, and table management."
  },
  {
    question: "How long does it take to implement Toast POS?",
    answer: "A typical Toast POS implementation takes 1-3 weeks from contract signing to go-live. This includes hardware setup, menu configuration, staff training, and integration with your existing systems. Complex multi-location setups may take longer."
  },
  {
    question: "Can I migrate my existing menu to Toast?",
    answer: "Yes, your existing menu can be migrated to Toast. The process involves exporting your current menu data, reformatting it for Toast's structure, and uploading it to the system. Our menu builder tool can help with this process, handling complex modifier groups and pricing rules."
  },
  {
    question: "What support options are available for Toast POS users?",
    answer: "Toast offers 24/7 phone and email support. Additionally, certified Toast consultants like R&G Consulting provide hands-on implementation support, custom menu configuration, and ongoing maintenance through Toast Guardian support plans starting at $350/month."
  }
];

const ToastHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');

  useSEO({
    title: 'Toast Hub | Toast POS Resources, Tips & News | R&G Consulting',
    description: 'Expert Toast POS guides, tips, industry news, and case studies. Learn how to optimize your restaurant operations with Toast. Free resources from certified Toast consultants.',
    canonical: 'https://ccrestaurantconsulting.com/#/toast-hub',
  });

  // Inject structured data for SEO
  useEffect(() => {
    // Blog schema
    const blogSchema = {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "Toast Hub - Toast POS Resources",
      "description": "Expert Toast POS guides, tips, industry news, and case studies for restaurant owners and managers.",
      "url": "https://ccrestaurantconsulting.com/#/toast-hub",
      "publisher": {
        "@type": "Organization",
        "name": "R&G Consulting LLC",
        "logo": {
          "@type": "ImageObject",
          "url": "https://ccrestaurantconsulting.com/logo.png"
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
          "name": post.author || "R&G Consulting"
        },
        "url": `https://ccrestaurantconsulting.com/#/toast-hub/${post.slug}`
      }))
    };

    // FAQ schema
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQ_DATA.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    // Remove existing schemas
    document.querySelectorAll('script[data-schema="toast-hub"]').forEach(el => el.remove());

    // Add blog schema
    const blogScript = document.createElement('script');
    blogScript.type = 'application/ld+json';
    blogScript.setAttribute('data-schema', 'toast-hub');
    blogScript.textContent = JSON.stringify(blogSchema);
    document.head.appendChild(blogScript);

    // Add FAQ schema
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.setAttribute('data-schema', 'toast-hub');
    faqScript.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqScript);

    return () => {
      document.querySelectorAll('script[data-schema="toast-hub"]').forEach(el => el.remove());
    };
  }, [posts]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Update URL when category changes
    if (selectedCategory !== 'all') {
      setSearchParams({ category: selectedCategory });
    } else {
      setSearchParams({});
    }
  }, [selectedCategory, setSearchParams]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [postsRes, categoriesRes] = await Promise.all([
        fetch('/api/toast-hub/posts'),
        fetch('/api/toast-hub/categories')
      ]);

      const postsResult = await postsRes.json();
      const categoriesResult = await categoriesRes.json();

      if (postsResult.success) {
        // Only show published posts
        setPosts(postsResult.data?.filter((p: Post) => p.status === 'published') || []);
      }
      if (categoriesResult.success) {
        setCategories(categoriesResult.data?.filter((c: Category) => c.is_active) || []);
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

  const featuredPosts = filteredPosts.filter(p => p.featured);
  const regularPosts = filteredPosts.filter(p => !p.featured);

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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <div className="inline-flex items-center gap-2 mb-4 text-amber-400">
            <FileText className="w-8 h-8" />
            <span className="text-sm font-semibold uppercase tracking-wider">Toast POS Resources</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Toast Hub
          </h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Expert guides, tips, industry news, and case studies to help you get the most out of your Toast POS system. Updated regularly by certified Toast consultants.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 animate-on-scroll">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => {
              const Icon = getCategoryIcon(cat.slug);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                    selectedCategory === cat.slug
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 animate-on-scroll">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Articles Found</h2>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Check back soon for new Toast POS content!'}
            </p>
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-amber-500 font-medium hover:text-amber-600 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
              <section className="mb-12 animate-on-scroll">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-500" />
                  Featured Articles
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {featuredPosts.map(post => (
                    <Link
                      key={post.id}
                      to={`/toast-hub/${post.slug}`}
                      className="group bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 hover:shadow-xl transition-all hover:border-amber-400"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Star className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                              {getCategoryName(post.category)}
                            </span>
                            {post.published_at && (
                              <span className="text-xs text-gray-500">
                                {formatDate(post.published_at)}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          <p className="text-gray-600 line-clamp-2 mb-3">
                            {post.excerpt || 'Read more about this topic...'}
                          </p>
                          <div className="flex items-center text-amber-600 font-medium text-sm">
                            Read Article
                            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Regular Posts Grid */}
            {regularPosts.length > 0 && (
              <section className="animate-on-scroll">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-gray-700" />
                  All Articles
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularPosts.map(post => {
                    const CategoryIcon = getCategoryIcon(post.category || '');
                    return (
                      <Link
                        key={post.id}
                        to={`/toast-hub/${post.slug}`}
                        className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all hover:border-amber-300"
                      >
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <CategoryIcon className="w-4 h-4 text-gray-600" />
                            </div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              {getCategoryName(post.category)}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                            {post.excerpt || 'Read more about this topic...'}
                          </p>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3 text-gray-400">
                              {post.published_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(post.published_at)}
                                </span>
                              )}
                              {post.view_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  {post.view_count}
                                </span>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
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

        {/* FAQ Section for SEO */}
        <section className="mt-20 animate-on-scroll">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <div className="brass-line-draw short mb-4" />
            <p className="text-gray-600">Common questions about Toast POS and our services</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {FAQ_DATA.map((faq, idx) => (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-20 animate-on-scroll">
          <div className="bg-primary-dark rounded-2xl p-8 md:p-12 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
              Need Help With Your Toast POS?
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-300 max-w-2xl mx-auto mb-8">
              From initial setup to ongoing support, our certified Toast consultants are here to help your restaurant succeed. Get expert guidance tailored to your operation.
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
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:bg-gray-100"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                View Support Plans
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ToastHub;
