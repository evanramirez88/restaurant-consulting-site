import { useEffect, useRef, useState, useCallback } from 'react';

interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook for scroll-triggered animations using Intersection Observer
 * Respects prefers-reduced-motion for accessibility
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible };
}

/**
 * Initialize scroll animations for elements with .animate-on-scroll class
 * Call this once in your app to enable automatic scroll animations
 */
export function initScrollAnimations(): () => void {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    // Show all elements immediately if user prefers reduced motion
    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      el.classList.add('is-visible');
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          element.classList.add('is-visible');

          // Handle staggered children
          const staggerChildren = element.querySelectorAll('.stagger-child');
          staggerChildren.forEach((child, index) => {
            (child as HTMLElement).style.transitionDelay = `${index * 100}ms`;
            child.classList.add('is-visible');
          });

          observer.unobserve(element);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  // Observe all elements with the animate-on-scroll class
  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    observer.observe(el);
  });

  // Return cleanup function
  return () => observer.disconnect();
}

/**
 * React hook that initializes scroll animations on mount
 */
export function useInitScrollAnimations() {
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const cleanup = initScrollAnimations();
      return cleanup;
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);
}

/**
 * Hook for parallax effect on scroll
 * Returns a ref and current parallax offset
 */
export function useParallax(speed: number = 0.5) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.scrollY;
      const rate = scrolled * speed;
      setOffset(rate);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return { ref, offset };
}
