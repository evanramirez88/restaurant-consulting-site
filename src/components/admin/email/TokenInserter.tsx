import React, { useState, useRef } from 'react';
import { ChevronDown, Hash } from 'lucide-react';

// Available tokens for email templates and sequences
export const EMAIL_TOKENS = [
  { token: '{{first_name}}', label: 'First Name', description: 'Contact first name' },
  { token: '{{last_name}}', label: 'Last Name', description: 'Contact last name' },
  { token: '{{company}}', label: 'Company', description: 'Company/Restaurant name' },
  { token: '{{email}}', label: 'Email', description: 'Contact email address' },
  { token: '{{phone}}', label: 'Phone', description: 'Contact phone number' },
  { token: '{{unsubscribe_link}}', label: 'Unsubscribe Link', description: 'Unsubscribe URL' },
];

interface TokenInserterProps {
  /** Callback when a token is selected */
  onInsert: (token: string) => void;
  /** Reference to the target input/textarea for cursor position insertion */
  targetRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  /** Optional className for the button */
  className?: string;
  /** Button size variant */
  size?: 'sm' | 'md';
}

/**
 * TokenInserter - Reusable dropdown for inserting email tokens
 *
 * Can work in two modes:
 * 1. With targetRef: Inserts token at cursor position in the referenced input/textarea
 * 2. Without targetRef: Calls onInsert with the token, parent component handles insertion
 */
const TokenInserter: React.FC<TokenInserterProps> = ({
  onInsert,
  targetRef,
  className = '',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTokenClick = (token: string) => {
    if (targetRef?.current) {
      const element = targetRef.current;
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = element.value;

      // Insert token at cursor position
      const newValue = currentValue.substring(0, start) + token + currentValue.substring(end);

      // Update the value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement?.prototype || window.HTMLInputElement?.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, newValue);
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
      }

      // Set cursor position after the inserted token
      const newCursorPos = start + token.length;
      setTimeout(() => {
        element.setSelectionRange(newCursorPos, newCursorPos);
        element.focus();
      }, 0);
    }

    onInsert(token);
    setIsOpen(false);
  };

  const buttonClasses = size === 'sm'
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-2 text-sm gap-2';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center ${buttonClasses} bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 transition-colors`}
      >
        <Hash className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        <span>Insert Token</span>
        <ChevronDown className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <p className="text-xs text-gray-400">Available Tokens</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {EMAIL_TOKENS.map((item) => (
              <button
                key={item.token}
                type="button"
                onClick={() => handleTokenClick(item.token)}
                className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex flex-col"
              >
                <div className="flex items-center gap-2">
                  <code className="text-amber-400 text-xs bg-amber-500/10 px-1.5 py-0.5 rounded">
                    {item.token}
                  </code>
                </div>
                <span className="text-gray-400 text-xs mt-1">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenInserter;
