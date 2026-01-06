import React, { useState, useEffect, useRef } from 'react';
import { Phone, Mail, Calendar, MapPin, Clock, X, ChevronDown, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PHONE_NUMBER, EMAIL_ADDRESS } from '../../constants';

type AvailabilityStatus = 'available' | 'busy' | 'offline';
type LocationType = 'remote' | 'onsite' | 'both';

interface AvailabilityData {
  status: AvailabilityStatus;
  locationType: LocationType;
  town: string | null;
  address: string | null;
  walkInsAccepted: boolean;
  schedulingAvailable: boolean;
  customMessage: string | null;
  updatedAt: number | null;
}

const AvailabilityIndicator: React.FC = () => {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await fetch('/api/availability');
        const result = await response.json();
        if (result.success && result.data) {
          setAvailability(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();

    // Refresh every 5 minutes
    const interval = setInterval(fetchAvailability, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isExpanded]);

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (isLoading || !availability) {
    return null;
  }

  const statusConfig = {
    available: {
      color: 'bg-green-500',
      pulseColor: 'bg-green-400',
      textColor: 'text-green-400',
      label: 'Available'
    },
    busy: {
      color: 'bg-yellow-500',
      pulseColor: 'bg-yellow-400',
      textColor: 'text-yellow-400',
      label: 'Busy'
    },
    offline: {
      color: 'bg-orange-500',
      pulseColor: 'bg-orange-400',
      textColor: 'text-orange-500',
      label: 'Get Quote'
    }
  };

  const config = statusConfig[availability.status];

  const locationLabel = () => {
    if (availability.locationType === 'remote') return 'Remote';
    if (availability.locationType === 'onsite' && availability.town) return `in ${availability.town}`;
    if (availability.locationType === 'both' && availability.town) return `Remote & ${availability.town}`;
    if (availability.locationType === 'both') return 'Remote & On-Site';
    if (availability.locationType === 'onsite') return 'On-Site';
    return '';
  };

  const compactLabel = () => {
    const loc = locationLabel();
    return loc ? `${config.label} ${loc}` : config.label;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Compact Badge Container */}
      <div className="flex items-center gap-2">
        {/* Status Badge (clickable) */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 min-h-[36px]"
          aria-expanded={isExpanded}
          aria-label={`Availability: ${compactLabel()}`}
        >
          {/* Status Dot with Pulse */}
          <span className="relative flex h-2.5 w-2.5">
            {availability.status === 'available' && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.color}`} />
          </span>

          <span className={`text-sm font-medium ${config.textColor} dark:${config.textColor}`}>
            {compactLabel()}
          </span>

          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Always-visible mini Get Quote button */}
        <Link
          to="/quote"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors min-h-[32px] shadow-sm hover:shadow"
          aria-label="Get a quote"
        >
          <FileText className="w-3 h-3" />
          <span>Quote</span>
        </Link>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className={`px-4 py-3 ${
            availability.status === 'available' ? 'bg-green-500' :
            availability.status === 'busy' ? 'bg-yellow-500' : 'bg-orange-500'
          } text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {availability.status === 'available' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
                <span className="font-semibold">
                  {availability.status === 'offline' ? 'Request a Quote' : config.label}
                  {availability.town && availability.status !== 'offline' && ` in ${availability.town}`}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Offline - Prominent Get Quote CTA */}
            {availability.status === 'offline' && (
              <Link
                to="/quote"
                onClick={() => setIsExpanded(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors min-h-[48px] shadow-md hover:shadow-lg"
              >
                <FileText className="w-4 h-4" />
                Get Your Free Quote
              </Link>
            )}

            {/* Location Type */}
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">
                {availability.status === 'offline' ? (
                  'We respond to quotes within 24 hours'
                ) : (
                  <>
                    {availability.locationType === 'remote' && 'Available for remote consultations'}
                    {availability.locationType === 'onsite' && 'Available for on-site visits'}
                    {availability.locationType === 'both' && 'Available remote or on-site'}
                  </>
                )}
              </span>
            </div>

            {/* Address if provided */}
            {availability.address && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-400">{availability.address}</span>
              </div>
            )}

            {/* Indicators */}
            <div className="flex flex-wrap gap-2">
              {availability.walkInsAccepted && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Walk-ins Welcome
                </span>
              )}
              {availability.schedulingAvailable && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                  <Calendar className="w-3 h-3" />
                  Scheduling Available
                </span>
              )}
            </div>

            {/* Custom Message */}
            {availability.customMessage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300 italic">
                  "{availability.customMessage}"
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`tel:${PHONE_NUMBER}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
              <a
                href={`mailto:${EMAIL_ADDRESS}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-600 min-h-[44px]"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>

            {availability.schedulingAvailable && (
              <a
                href="/#/schedule"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary-dark hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
              >
                <Calendar className="w-4 h-4" />
                Schedule Consultation
              </a>
            )}

            {/* Updated Time */}
            {availability.updatedAt && (
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {formatTimeAgo(availability.updatedAt)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityIndicator;
