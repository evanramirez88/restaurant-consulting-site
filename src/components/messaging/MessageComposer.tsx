import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, X, Lock, Loader2, Image, FileText, File } from 'lucide-react';

interface MessageComposerProps {
  onSend: (body: string, isPrivate: boolean, attachments: File[]) => Promise<void>;
  isSending: boolean;
  viewerType: 'admin' | 'client' | 'rep';
  allowPrivate?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  isSending,
  viewerType,
  allowPrivate = false,
  disabled = false,
  placeholder = 'Type your message...'
}) => {
  const [message, setMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!message.trim() && attachments.length === 0) return;
    if (disabled || isSending) return;

    try {
      await onSend(message.trim(), isPrivate, attachments);
      setMessage('');
      setAttachments([]);
      setIsPrivate(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Limit to 5 attachments
      const newAttachments = [...attachments, ...files].slice(0, 5);
      setAttachments(newAttachments);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    }
    if (file.type.includes('pdf') || file.type.includes('document')) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  return (
    <div className="bg-gray-800/50 p-4">
      {/* Private message toggle (admin only) */}
      {allowPrivate && (
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="sr-only"
              disabled={disabled}
            />
            <div className={`w-10 h-5 rounded-full relative transition-colors ${
              isPrivate ? 'bg-amber-500' : 'bg-gray-600'
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                isPrivate ? 'left-5' : 'left-0.5'
              }`} />
            </div>
            <span className={`text-sm flex items-center gap-1 ${
              isPrivate ? 'text-amber-400' : 'text-gray-400'
            }`}>
              <Lock className="w-3 h-3" />
              Private message (not visible to client)
            </span>
          </label>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-sm"
            >
              {getFileIcon(file)}
              <span className="text-gray-200 truncate max-w-[150px]">{file.name}</span>
              <span className="text-gray-500 text-xs">{formatFileSize(file.size)}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="p-0.5 hover:bg-gray-600 rounded transition-colors"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message input */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= 5}
          className={`p-2 rounded-lg transition-colors ${
            disabled || attachments.length >= 5
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          title={attachments.length >= 5 ? 'Maximum 5 attachments' : 'Attach file'}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ minHeight: '44px', maxHeight: '150px' }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || isSending || (!message.trim() && attachments.length === 0)}
          className={`p-3 rounded-lg transition-colors ${
            disabled || isSending || (!message.trim() && attachments.length === 0)
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-gray-900'
          }`}
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>Press Enter to send, Shift+Enter for new line</span>
        {attachments.length > 0 && (
          <span>{attachments.length}/5 attachments</span>
        )}
      </div>
    </div>
  );
};

export default MessageComposer;
