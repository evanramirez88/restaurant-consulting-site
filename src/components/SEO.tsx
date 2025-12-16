import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
}

// Site-wide SEO constants
export const SITE_NAME = 'Cape Cod Restaurant Consulting';
export const SITE_URL = 'https://ccrestaurantconsulting.com';
export const DEFAULT_OG_IMAGE = 'https://ccrestaurantconsulting.com/og-image.jpg';
export const DEFAULT_OG_DESCRIPTION = 'Expert Toast POS implementation, networking, and operations consulting for restaurants across New England.';

/**
 * Custom SEO hook for managing document meta tags
 * React 19 compatible - no external dependencies
 */
export function useSEO({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE
}: SEOProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper to update or create meta tag
    const setMetaTag = (name: string, content: string, property?: boolean) => {
      const attribute = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;

      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Helper to update or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;

      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Basic meta tags
    setMetaTag('description', description);

    // Open Graph tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', ogType, true);
    setMetaTag('og:site_name', SITE_NAME, true);
    setMetaTag('og:image', ogImage, true);

    if (canonical) {
      setMetaTag('og:url', canonical, true);
      setLinkTag('canonical', canonical);
    }

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);

    // Cleanup function - reset to defaults on unmount
    return () => {
      document.title = `${SITE_NAME} | R&G Consulting LLC`;
    };
  }, [title, description, canonical, ogType, ogImage]);
}

/**
 * SEO component wrapper - can be used declaratively
 */
export default function SEO(props: SEOProps) {
  useSEO(props);
  return null;
}
