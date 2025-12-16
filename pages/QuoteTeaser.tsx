import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// Acuity Scheduling configuration
const ACUITY_URL = 'https://app.acuityscheduling.com/schedule.php?owner=34242148';

const QuoteTeaser: React.FC = () => {
  useSEO({
    title: 'Quote Builder | Cape Cod Consulting',
    description: 'Build a custom Toast POS configuration for your restaurant. Get instant estimates for installation time and support costs. Design your floor layout with our interactive canvas.',
    canonical: 'https://ccrestaurantconsulting.com/#/quote',
  });

  return (
    <div className="bg-ink min-h-screen flex items-center justify-center relative hero-grain">
      {/* Full page centered content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">

        {/* Animated Preview Mockup */}
        <div className="hero-fade-in mb-12">
          <div className="quote-preview-container">
            {/* Floating animated mockup of the floor plan canvas */}
            <div className="quote-preview-mockup">
              {/* Grid background */}
              <div className="quote-preview-grid">
                {/* Animated "stations" on the grid */}
                <div className="preview-station preview-station-1">
                  <div className="station-icon"></div>
                  <span>POS</span>
                </div>
                <div className="preview-station preview-station-2">
                  <div className="station-icon station-kds"></div>
                  <span>KDS</span>
                </div>
                <div className="preview-station preview-station-3">
                  <div className="station-icon station-bar"></div>
                  <span>Bar</span>
                </div>
                {/* Connection lines */}
                <svg className="preview-connections" viewBox="0 0 300 200" preserveAspectRatio="none">
                  <path
                    className="connection-line connection-line-1"
                    d="M75 100 Q150 50 225 100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                  <path
                    className="connection-line connection-line-2"
                    d="M75 100 Q110 150 150 140"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                </svg>
              </div>
              {/* Floating estimate bubble */}
              <div className="preview-estimate-bubble">
                <span className="estimate-label">Est. Install</span>
                <span className="estimate-value">~4.5 hrs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="hero-fade-in hero-fade-in-delay-1 font-serif text-5xl md:text-6xl font-bold text-mint mb-4">
          Quote Builder
        </h1>

        {/* Subheadline */}
        <div className="hero-fade-in hero-fade-in-delay-1 mb-10">
          <p className="text-2xl md:text-3xl text-cream font-serif mb-3">
            Configure Your POS System
          </p>
          <div className="brass-underline mx-auto"></div>
        </div>

        {/* Body Copy */}
        <div className="hero-fade-in hero-fade-in-delay-2 mb-12 max-w-2xl mx-auto">
          <p className="text-lg text-mist leading-relaxed mb-6">
            Build a custom Toast POS configuration for your restaurant. Get instant
            estimates for installation time and support costs. Design your floor layout
            with our interactive canvas.
          </p>
          <p className="text-mint font-medium text-lg">
            Interactive configuration &bull; Instant estimates &bull; Scheduling integration
          </p>
        </div>

        {/* CTAs */}
        <div className="hero-fade-in hero-fade-in-delay-3 flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/quote-builder"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-mint text-ink rounded-lg font-semibold hover:bg-mint/90 transition-all glow-pulse"
          >
            Launch Quote Builder
          </Link>
          <a
            href={ACUITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent text-cream rounded-lg font-semibold border border-line hover:border-brass hover:text-brass transition-all"
          >
            <Calendar size={20} />
            Schedule Consultation Instead
          </a>
        </div>

        {/* Back to Home Link */}
        <div className="hero-fade-in hero-fade-in-delay-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-mist hover:text-brass transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Inline styles for the preview mockup */}
      <style>{`
        .quote-preview-container {
          display: flex;
          justify-content: center;
          perspective: 1000px;
        }

        .quote-preview-mockup {
          position: relative;
          width: 320px;
          height: 220px;
          background: linear-gradient(135deg, var(--color-coal), var(--color-slate));
          border: 1px solid var(--color-line);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotateX(5deg) rotateY(-5deg);
          }
          50% {
            transform: translateY(-15px) rotateX(5deg) rotateY(-5deg);
          }
        }

        .quote-preview-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(52, 211, 153, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(52, 211, 153, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
          padding: 20px;
        }

        .preview-station {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--color-mist);
          animation: station-pulse 3s ease-in-out infinite;
        }

        .station-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--color-mint), #2ab584);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(52, 211, 153, 0.3);
        }

        .station-kds {
          background: linear-gradient(135deg, var(--color-brass), #b8943a);
          box-shadow: 0 4px 12px rgba(201, 169, 98, 0.3);
        }

        .station-bar {
          background: linear-gradient(135deg, var(--color-bay), #0284c7);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
        }

        .preview-station-1 {
          top: 80px;
          left: 40px;
          animation-delay: 0s;
        }

        .preview-station-2 {
          top: 80px;
          right: 40px;
          animation-delay: 0.5s;
        }

        .preview-station-3 {
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          animation-delay: 1s;
        }

        @keyframes station-pulse {
          0%, 100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(-3px);
            opacity: 0.85;
          }
        }

        .preview-station-3 {
          animation: station-pulse-center 3s ease-in-out infinite 1s;
        }

        @keyframes station-pulse-center {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateX(-50%) translateY(-3px);
            opacity: 0.85;
          }
        }

        .preview-connections {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          color: var(--color-mint);
          opacity: 0.4;
        }

        .connection-line {
          stroke-dashoffset: 100;
          animation: dash-flow 3s linear infinite;
        }

        .connection-line-2 {
          animation-delay: 1.5s;
        }

        @keyframes dash-flow {
          to {
            stroke-dashoffset: 0;
          }
        }

        .preview-estimate-bubble {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(11, 11, 13, 0.9);
          border: 1px solid var(--color-mint);
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          animation: bubble-glow 2s ease-in-out infinite;
        }

        @keyframes bubble-glow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(52, 211, 153, 0.2);
          }
          50% {
            box-shadow: 0 0 20px rgba(52, 211, 153, 0.4);
          }
        }

        .estimate-label {
          font-size: 9px;
          color: var(--color-mist);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .estimate-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-mint);
        }

        @media (min-width: 640px) {
          .quote-preview-mockup {
            width: 400px;
            height: 260px;
          }

          .preview-station-1 {
            top: 100px;
            left: 50px;
          }

          .preview-station-2 {
            top: 100px;
            right: 50px;
          }

          .preview-station-3 {
            bottom: 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default QuoteTeaser;
