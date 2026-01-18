import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Loader2, FileText, Target, DollarSign, Users,
  Heart, Calendar, Mail, Headphones, Sparkles, Bot, User, RefreshCw,
  Zap, TrendingUp, AlertCircle, ChevronDown
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ContextSnapshot {
  mrr: number;
  clients: number;
  hotLeads: number;
  openTickets: number;
}

interface ConsoleData {
  quickActions: QuickAction[];
  context: any;
  capabilities: string[];
  modelInfo: {
    available: boolean;
    model: string;
  };
}

const iconMap: { [key: string]: React.ReactNode } = {
  FileText: <FileText className="w-4 h-4" />,
  Target: <Target className="w-4 h-4" />,
  DollarSign: <DollarSign className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />,
  Mail: <Mail className="w-4 h-4" />,
  Headphones: <Headphones className="w-4 h-4" />
};

export default function BusinessBriefAIConsole() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConsoleData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConsoleData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/business-brief/ai');
      const result = await response.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch AI console data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || sending) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/admin/business-brief/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: content,
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: result.success ? result.response : 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: 'Sorry, I encountered a connection error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = async (action: QuickAction) => {
    if (sending) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: action.label,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setSending(true);

    try {
      const response = await fetch('/api/admin/business-brief/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.id })
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: result.success ? result.response : 'Sorry, I encountered an error.',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Quick action failed:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
  };

  if (loading) {
    return (
      <div className="admin-card p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-gray-400">Initializing AI Console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Context */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-medium">AI Business Advisor</h2>
              <p className="text-xs text-gray-500">
                {data?.modelInfo?.available
                  ? `Powered by ${data.modelInfo.model.split('/').pop()}`
                  : 'Smart insights mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowContext(!showContext)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                ${showContext
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
                }
              `}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Context</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showContext ? 'rotate-180' : ''}`} />
            </button>

            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                title="Clear conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Context Panel */}
        {showContext && data?.context && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">MRR</p>
                <p className="text-lg font-bold text-green-400">
                  ${data.context.revenue?.mrr?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {data.context.revenue?.progress || 0}% to goal
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Clients</p>
                <p className="text-lg font-bold text-blue-400">
                  {data.context.clients?.total || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {data.context.clients?.activePlans || 0} with plans
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Hot Leads</p>
                <p className="text-lg font-bold text-amber-400">
                  {data.context.leads?.hot || 0}
                </p>
                <p className="text-xs text-gray-500">
                  80+ score
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Open Tickets</p>
                <p className="text-lg font-bold text-purple-400">
                  {data.context.support?.openTickets || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {data.context.support?.urgent || 0} urgent
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions (show only if no messages) */}
      {messages.length === 0 && data?.quickActions && (
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={sending}
                className={`
                  flex items-center gap-2 p-3 rounded-lg text-left transition-all
                  ${sending
                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <div className="p-1.5 bg-gray-700 rounded">
                  {iconMap[action.icon] || <Zap className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="admin-card flex flex-col" style={{ height: messages.length > 0 ? '500px' : '300px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium">How can I help you today?</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Ask me about your business metrics, lead strategies, revenue analysis, or click a quick action above.
              </p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                  ${message.role === 'user'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-purple-500/20 text-purple-400'
                  }
                `}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                <div className={`
                  flex-1 max-w-[80%] rounded-lg p-3
                  ${message.role === 'user'
                    ? 'bg-amber-500/10 text-white ml-auto'
                    : 'bg-gray-800 text-gray-200'
                  }
                `}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    {message.content.split('\n').map((line, i) => {
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <h4 key={i} className="text-white font-semibold mt-2 mb-1">{line.replace(/\*\*/g, '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <li key={i} className="text-gray-300 ml-4">{line.substring(2)}</li>;
                      }
                      if (line.match(/^\d+\./)) {
                        return <li key={i} className="text-gray-300 ml-4">{line.substring(line.indexOf('.') + 2)}</li>;
                      }
                      if (line.trim() === '') {
                        return <br key={i} />;
                      }
                      return <p key={i} className="text-gray-300">{line}</p>;
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your business..."
              disabled={sending}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className={`
                p-2 rounded-lg transition-all
                ${sending || !input.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
                }
              `}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {messages.length > 0 && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-700/50">
              <span className="text-xs text-gray-500">Quick:</span>
              {data?.quickActions?.slice(0, 4).map(action => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  disabled={sending}
                  className="text-xs text-gray-400 hover:text-amber-400 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {messages.length === 0 && data?.capabilities && (
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">What I can help with</h3>
          <div className="flex flex-wrap gap-2">
            {data.capabilities.map((cap, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
