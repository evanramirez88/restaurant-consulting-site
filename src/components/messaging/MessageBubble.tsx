import React from 'react';
import { User, Building2, Shield, Bot, Paperclip, Download, ExternalLink, Lock } from 'lucide-react';

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_type: 'admin' | 'client' | 'rep' | 'system';
  sender_id: string | null;
  sender_name?: string;
  recipient_type: 'admin' | 'client' | 'rep' | 'all' | null;
  recipient_id: string | null;
  subject: string | null;
  body: string;
  body_format: 'text' | 'html' | 'markdown';
  is_private: boolean;
  visible_to_client: boolean;
  visible_to_rep: boolean;
  attachments_json: string | null;
  read_at: number | null;
  created_at: number;
}

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  viewerType: 'admin' | 'client' | 'rep';
  showPrivateIndicator?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  viewerType,
  showPrivateIndicator = true
}) => {
  const attachments: Attachment[] = message.attachments_json
    ? JSON.parse(message.attachments_json)
    : [];

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (isThisYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSenderIcon = () => {
    switch (message.sender_type) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'client':
        return <Building2 className="w-4 h-4" />;
      case 'rep':
        return <User className="w-4 h-4" />;
      case 'system':
        return <Bot className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getSenderLabel = () => {
    if (message.sender_name) return message.sender_name;

    switch (message.sender_type) {
      case 'admin':
        return 'Admin';
      case 'client':
        return 'Client';
      case 'rep':
        return 'Rep';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  const isPrivateMessage = message.is_private || !message.visible_to_client || !message.visible_to_rep;

  const getPrivacyLabel = () => {
    if (message.is_private) return 'Private';
    if (!message.visible_to_client) return 'Not visible to client';
    if (!message.visible_to_rep) return 'Not visible to rep';
    return null;
  };

  // System messages have a special style
  if (message.sender_type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-full text-sm text-gray-400">
          <Bot className="w-4 h-4" />
          <span>{message.body}</span>
          <span className="text-gray-500 text-xs">
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Sender info */}
        <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          {!isOwnMessage && (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              message.sender_type === 'admin' ? 'bg-amber-500/20 text-amber-400' :
              message.sender_type === 'client' ? 'bg-blue-500/20 text-blue-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {getSenderIcon()}
            </div>
          )}
          <span className="text-xs text-gray-400">{getSenderLabel()}</span>
          <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
          {showPrivateIndicator && isPrivateMessage && viewerType === 'admin' && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Lock className="w-3 h-3" />
              {getPrivacyLabel()}
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          isOwnMessage
            ? 'bg-amber-500 text-gray-900 rounded-tr-sm'
            : 'bg-gray-700 text-white rounded-tl-sm'
        } ${isPrivateMessage && viewerType === 'admin' ? 'border-l-2 border-amber-400' : ''}`}>
          {message.subject && (
            <div className={`font-semibold mb-1 ${isOwnMessage ? 'text-gray-800' : 'text-gray-200'}`}>
              {message.subject}
            </div>
          )}
          <div className={`whitespace-pre-wrap break-words ${
            isOwnMessage ? 'text-gray-900' : 'text-gray-100'
          }`}>
            {message.body}
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className={`mt-2 space-y-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
            {attachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isOwnMessage
                    ? 'bg-amber-600/80 text-white hover:bg-amber-600'
                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{attachment.name}</span>
                <span className="text-xs opacity-70">{formatFileSize(attachment.size)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        )}

        {/* Read status */}
        {isOwnMessage && message.read_at && (
          <div className="text-right mt-1">
            <span className="text-xs text-gray-500">
              Read {formatTime(message.read_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
