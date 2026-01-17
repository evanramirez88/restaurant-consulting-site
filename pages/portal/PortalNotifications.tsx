import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Info,
  AlertCircle,
  Gift,
  Flag,
  Settings,
  X,
  ExternalLink,
  Check,
  Trash2
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface Notification {
  id: string;
  notification_type: 'info' | 'action_required' | 'upsell' | 'milestone' | 'system' | 'reminder';
  title: string;
  body: string | null;
  action_url: string | null;
  action_label: string | null;
  upsell_product_id: string | null;
  upsell_amount: number | null;
  upsell_discount_pct: number | null;
  is_read: number;
  read_at: number | null;
  is_dismissed: number;
  is_actioned: number;
  created_at: number;
}

// ============================================
// PORTAL NOTIFICATIONS PAGE
// ============================================
const PortalNotifications: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useSEO({
    title: 'Notifications | Client Portal',
    description: 'View your notifications and updates.',
  });

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, [slug]);

  const loadNotifications = async () => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/portal/${slug}/notifications`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError(data.error || 'Failed to load notifications');
      }
    } catch (err) {
      console.error('Notifications load error:', err);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle notification actions
  const handleAction = async (notificationId: string, action: 'read' | 'dismiss' | 'action' | 'mark_all_read') => {
    if (!slug) return;

    setActionInProgress(notificationId);
    try {
      const response = await fetch(`/api/portal/${slug}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notificationId: action === 'mark_all_read' ? undefined : notificationId
        })
      });

      const data = await response.json();

      if (data.success) {
        loadNotifications(); // Refresh
      }
    } catch (err) {
      console.error('Notification action error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle action button click
  const handleActionClick = (notification: Notification) => {
    // Mark as actioned
    handleAction(notification.id, 'action');

    // Navigate to action URL if present
    if (notification.action_url) {
      if (notification.action_url.startsWith('http')) {
        window.open(notification.action_url, '_blank');
      } else {
        navigate(notification.action_url);
      }
    }
  };

  // Utility functions
  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  };

  const getNotificationConfig = (type: string) => {
    switch (type) {
      case 'upsell':
        return {
          icon: <Gift className="w-5 h-5" />,
          color: 'text-purple-400',
          bgColor: 'bg-purple-400/10 border-purple-400/30',
          label: 'Special Offer'
        };
      case 'action_required':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: 'text-amber-400',
          bgColor: 'bg-amber-400/10 border-amber-400/30',
          label: 'Action Required'
        };
      case 'milestone':
        return {
          icon: <Flag className="w-5 h-5" />,
          color: 'text-green-400',
          bgColor: 'bg-green-400/10 border-green-400/30',
          label: 'Milestone'
        };
      case 'reminder':
        return {
          icon: <Bell className="w-5 h-5" />,
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10 border-blue-400/30',
          label: 'Reminder'
        };
      case 'system':
        return {
          icon: <Settings className="w-5 h-5" />,
          color: 'text-gray-400',
          bgColor: 'bg-gray-400/10 border-gray-400/30',
          label: 'System'
        };
      default:
        return {
          icon: <Info className="w-5 h-5" />,
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10 border-blue-400/30',
          label: 'Info'
        };
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read && !n.is_dismissed;
    return !n.is_dismissed;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Notifications</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-400">Stay updated on your projects and services</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => handleAction('all', 'mark_all_read')}
            className="inline-flex items-center gap-2 px-4 py-2 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-gray-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <BellOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Notifications</h3>
          <p className="text-gray-400">
            {filter === 'unread'
              ? "You're all caught up! No unread notifications."
              : "You don't have any notifications yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const config = getNotificationConfig(notification.notification_type);
            const isUnread = !notification.is_read;

            return (
              <div
                key={notification.id}
                className={`admin-card overflow-hidden transition-all ${
                  isUnread ? 'ring-1 ring-amber-500/30' : ''
                }`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg border ${config.bgColor}`}>
                      <div className={config.color}>
                        {config.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            {isUnread && (
                              <span className="w-2 h-2 bg-amber-400 rounded-full" />
                            )}
                          </div>
                          <h3 className={`text-base font-medium ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                            {notification.title}
                          </h3>
                          {notification.body && (
                            <p className="text-gray-400 text-sm mt-1">
                              {notification.body}
                            </p>
                          )}

                          {/* Upsell pricing */}
                          {notification.notification_type === 'upsell' && notification.upsell_amount && (
                            <div className="mt-2">
                              <span className="text-lg font-bold text-purple-400">
                                {formatCurrency(notification.upsell_amount)}
                              </span>
                              {notification.upsell_discount_pct && (
                                <span className="ml-2 text-sm text-green-400">
                                  ({notification.upsell_discount_pct}% off)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTimeAgo(notification.created_at)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-4">
                        {notification.action_url && (
                          <button
                            onClick={() => handleActionClick(notification)}
                            disabled={actionInProgress === notification.id}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              notification.notification_type === 'upsell'
                                ? 'bg-purple-500 text-white hover:bg-purple-600'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            {notification.action_label || 'View'}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}

                        {isUnread && (
                          <button
                            onClick={() => handleAction(notification.id, 'read')}
                            disabled={actionInProgress === notification.id}
                            className="inline-flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            Mark Read
                          </button>
                        )}

                        <button
                          onClick={() => handleAction(notification.id, 'dismiss')}
                          disabled={actionInProgress === notification.id}
                          className="inline-flex items-center gap-1 px-3 py-2 text-gray-500 hover:text-red-400 text-sm transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalNotifications;
