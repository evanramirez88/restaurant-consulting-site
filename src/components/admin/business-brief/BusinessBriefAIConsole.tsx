import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Loader2, FileText, Target, DollarSign, Users,
  Calendar, Mail, Sparkles, Bot, User, RefreshCw, Settings, Network, Library,
  Upload, Trash2, Plus, Eye, EyeOff, ChevronDown, Code, FileEdit, Search,
  BarChart2, Paperclip, X, Copy, Check, AlertTriangle, Database, Sliders,
  Cpu, BookOpen, Wand2, MessageCircle
} from 'lucide-react';

// Types matching Millstone Intelligence prototype
interface AIProvider {
  id: string;
  name: string;
  provider_type: string;
  is_default: boolean;
}

interface AIModel {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  category: string;
  is_default: boolean;
}

interface AIAssistant {
  id: string;
  name: string;
  description: string;
  system_instructions: string;
  persona: string;
  model_id: string;
  include_business_context: boolean;
  include_lead_context: boolean;
  include_personal_context: boolean;
  is_default: boolean;
}

interface SpeakingStyle {
  id: string;
  name: string;
  instructions: string;
  category: string;
}

interface IntelligenceFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

interface ContextDataSource {
  id: string;
  name: string;
  source_type: string;
  tier: number;
  is_business: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model_used?: string;
  builder_mode?: string;
  attachments?: { name: string; type: string; size: number }[];
}

interface Session {
  id: string;
  title: string;
  assistant_id: string | null;
  model_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ConsoleConfig {
  providers: AIProvider[];
  models: AIModel[];
  assistants: AIAssistant[];
  styles: SpeakingStyle[];
  folders: IntelligenceFolder[];
  dataSources: ContextDataSource[];
  builderModes: { id: string; label: string; icon: string }[];
}

type Tab = 'chat' | 'assistants' | 'connections' | 'context' | 'settings';
type BuilderMode = 'none' | 'code' | 'write' | 'research' | 'analysis';

const builderModeConfig: { id: BuilderMode; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'none', label: 'Chat', icon: <MessageCircle className="w-4 h-4" />, color: 'gray' },
  { id: 'code', label: 'Code', icon: <Code className="w-4 h-4" />, color: 'blue' },
  { id: 'write', label: 'Write', icon: <FileEdit className="w-4 h-4" />, color: 'green' },
  { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" />, color: 'purple' },
  { id: 'analysis', label: 'Analysis', icon: <BarChart2 className="w-4 h-4" />, color: 'amber' },
];

export default function BusinessBriefAIConsole() {
  // Config state
  const [config, setConfig] = useState<ConsoleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [configTab, setConfigTab] = useState<Tab>('chat');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings state
  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('none');
  const [attachments, setAttachments] = useState<File[]>([]);

  // Context state
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [businessContext, setBusinessContext] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load config and sessions on mount
  useEffect(() => {
    loadConfig();
    loadSessions();
    loadBusinessContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/intelligence-console/config');
      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
        // Set defaults
        const defaultAssistant = result.data.assistants?.find((a: AIAssistant) => a.is_default);
        const defaultModel = result.data.models?.find((m: AIModel) => m.is_default);
        if (defaultAssistant) setSelectedAssistant(defaultAssistant.id);
        if (defaultModel) setSelectedModel(defaultModel.id);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/admin/intelligence-console/sessions');
      const result = await response.json();
      if (result.success) {
        setSessions(result.data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadBusinessContext = async () => {
    try {
      const response = await fetch('/api/admin/intelligence-console/context?type=summary');
      const result = await response.json();
      if (result.success) {
        setBusinessContext(result.data);
      }
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  };

  const createSession = async () => {
    try {
      const response = await fetch('/api/admin/intelligence-console/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Session',
          assistant_id: selectedAssistant,
          model_id: selectedModel,
        }),
      });
      const result = await response.json();
      if (result.success) {
        const newSession = result.data;
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || sending) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      builder_mode: builderMode !== 'none' ? builderMode : undefined,
      attachments: attachments.map(f => ({ name: f.name, type: f.type, size: f.size })),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setSending(true);

    try {
      const response = await fetch('/api/admin/intelligence-console/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          session_id: activeSessionId,
          assistant_id: selectedAssistant,
          model_id: selectedModel,
          style_id: selectedStyle,
          builder_mode: builderMode,
          conversation_history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: result.success ? result.response : 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now(),
        model_used: result.model_used,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: 'Sorry, I encountered a connection error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const syncDataSources = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/intelligence-console/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_internal' }),
      });
      const result = await response.json();
      if (result.success) {
        loadBusinessContext();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setActiveSessionId(null);
  };

  // Tab Button Component
  const TabButton = ({ id, label, icon: Icon }: { id: Tab; label: string; icon: React.ElementType }) => (
    <button
      onClick={() => setConfigTab(id)}
      className={`
        flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
        ${configTab === id
          ? 'bg-amber-500/20 text-amber-400'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="admin-card p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-gray-400">Initializing Intelligence Console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Tabs */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-medium">Intelligence Console</h2>
              <p className="text-xs text-gray-500">
                Multi-model AI with business context
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
            <TabButton id="chat" label="Chat" icon={MessageSquare} />
            <TabButton id="assistants" label="Assistants" icon={Bot} />
            <TabButton id="context" label="Context" icon={Database} />
            <TabButton id="connections" label="Providers" icon={Network} />
            <TabButton id="settings" label="Settings" icon={Settings} />
          </div>
        </div>
      </div>

      {/* Main Content based on Tab */}
      {configTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sessions Sidebar */}
          <div className="admin-card p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">Sessions</h3>
              <button
                onClick={createSession}
                className="p-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30"
                title="New Session"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No sessions yet</p>
              ) : (
                sessions.slice(0, 10).map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setActiveSessionId(session.id);
                      // Load session messages
                    }}
                    className={`
                      w-full text-left p-2 rounded-lg text-sm transition-all
                      ${activeSessionId === session.id
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                      }
                    `}
                  >
                    <p className="font-medium truncate">{session.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(session.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Quick Settings */}
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assistant</label>
                <select
                  value={selectedAssistant || ''}
                  onChange={(e) => setSelectedAssistant(e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">Default</option>
                  {config?.assistants?.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={selectedModel || ''}
                  onChange={(e) => setSelectedModel(e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">Default</option>
                  {config?.models?.map(m => (
                    <option key={m.id} value={m.id}>{m.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Style</label>
                <select
                  value={selectedStyle || ''}
                  onChange={(e) => setSelectedStyle(e.target.value || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  <option value="">Default</option>
                  {config?.styles?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="admin-card flex flex-col lg:col-span-3" style={{ height: '600px' }}>
            {/* Builder Mode Toolbar */}
            <div className="p-3 border-b border-gray-700 flex items-center gap-2 overflow-x-auto">
              {builderModeConfig.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setBuilderMode(mode.id)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all
                    ${builderMode === mode.id
                      ? `bg-${mode.color}-500/20 text-${mode.color}-400 border border-${mode.color}-500/30`
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                    }
                  `}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}

              <div className="flex-1" />

              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                  title="Clear conversation"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setShowContextPanel(!showContextPanel)}
                className={`
                  p-2 rounded-lg transition-all
                  ${showContextPanel ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}
                `}
                title="Toggle context panel"
              >
                <Database className="w-4 h-4" />
              </button>
            </div>

            {/* Context Panel (collapsible) */}
            {showContextPanel && businessContext && (
              <div className="p-3 border-b border-gray-700 bg-gray-800/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">MRR</p>
                    <p className="text-lg font-bold text-green-400">
                      ${businessContext.mrr?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Clients</p>
                    <p className="text-lg font-bold text-blue-400">
                      {businessContext.clients_count || 0}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Hot Leads</p>
                    <p className="text-lg font-bold text-amber-400">
                      {businessContext.hot_leads || 0}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Context Items</p>
                    <p className="text-lg font-bold text-purple-400">
                      {businessContext.context_items || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                    <Wand2 className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-gray-400 font-medium">Intelligence Console</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    Multi-model AI assistant with full business context.
                    Ask about leads, clients, revenue, or use builder modes.
                  </p>

                  {/* Quick Prompts */}
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {[
                      'Summarize today\'s priorities',
                      'Which leads should I follow up with?',
                      'Analyze this month\'s revenue',
                      'Draft an email to a new lead',
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(prompt)}
                        className="px-3 py-1.5 bg-gray-800 text-gray-400 text-sm rounded-lg hover:bg-gray-700 hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
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
                      flex-1 max-w-[80%] rounded-lg p-3 relative group
                      ${message.role === 'user'
                        ? 'bg-amber-500/10 text-white ml-auto'
                        : 'bg-gray-800 text-gray-200'
                      }
                    `}>
                      {/* Builder mode badge */}
                      {message.builder_mode && (
                        <span className="absolute -top-2 left-2 px-2 py-0.5 bg-gray-700 text-xs text-gray-400 rounded">
                          {message.builder_mode}
                        </span>
                      )}

                      {/* Message content */}
                      <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {message.attachments.map((att, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400">
                              {att.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                        <p className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                          {message.model_used && ` • ${message.model_used}`}
                        </p>

                        {message.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(message.content, message.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white rounded"
                            title="Copy"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
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
                      <span className="text-sm">Processing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-700 flex flex-wrap gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm">
                    <Paperclip className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-300">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    builderMode === 'code' ? 'Describe what you want to build...' :
                    builderMode === 'write' ? 'What would you like me to write?' :
                    builderMode === 'research' ? 'What topic should I research?' :
                    builderMode === 'analysis' ? 'What data should I analyze?' :
                    'Ask anything about your business...'
                  }
                  disabled={sending}
                  rows={1}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
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
            </div>
          </div>
        </div>
      )}

      {/* Assistants Tab */}
      {configTab === 'assistants' && (
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">AI Assistants</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30">
              <Plus className="w-4 h-4" />
              Create Assistant
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config?.assistants?.map(assistant => (
              <div
                key={assistant.id}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Bot className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{assistant.name}</h4>
                      {assistant.is_default && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">Default</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{assistant.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {assistant.include_business_context && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Business</span>
                  )}
                  {assistant.include_lead_context && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Leads</span>
                  )}
                  {assistant.include_personal_context && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Personal
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedAssistant(assistant.id);
                    setConfigTab('chat');
                  }}
                  className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 hover:text-white"
                >
                  Use This Assistant
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context Tab */}
      {configTab === 'context' && (
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-white">Data Context Sources</h3>
              <p className="text-sm text-gray-500 mt-1">
                Data sources that enrich AI responses with business context
              </p>
            </div>
            <button
              onClick={syncDataSources}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync All
            </button>
          </div>

          {/* Data Boundary Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-400">Data Boundary Rules Active</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Personal data (SMS, calls, location) is filtered before entering this system.
                  Only business-relevant data matching HubSpot contacts is synced.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {config?.dataSources?.map(source => (
              <div
                key={source.id}
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    p-2 rounded-lg
                    ${source.is_business ? 'bg-green-500/20' : 'bg-yellow-500/20'}
                  `}>
                    <Database className={`w-5 h-5 ${source.is_business ? 'text-green-400' : 'text-yellow-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{source.name}</h4>
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                        Tier {source.tier}
                      </span>
                      {source.is_business ? (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Business</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Filtered</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {source.source_type} • Last sync: {source.last_sync_at ? new Date(source.last_sync_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={source.sync_enabled}
                      onChange={() => {}}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections Tab */}
      {configTab === 'connections' && (
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">AI Model Providers</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30">
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>

          <div className="space-y-4">
            {config?.providers?.map(provider => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{provider.name}</h4>
                    <p className="text-sm text-gray-500">{provider.provider_type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {provider.is_default && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">Default</span>
                  )}
                  <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 mb-4">Available Models</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {config?.models?.map(model => (
                <div
                  key={model.id}
                  className="p-3 bg-gray-800/30 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{model.display_name}</span>
                    {model.is_default && (
                      <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{model.model_id}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {configTab === 'settings' && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-medium text-white mb-6">Console Settings</h3>

          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Speaking Styles</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {config?.styles?.map(style => (
                  <div
                    key={style.id}
                    className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <h5 className="font-medium text-white text-sm">{style.name}</h5>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{style.instructions}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Data Boundaries</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-lg cursor-pointer hover:bg-gray-800/50">
                  <input type="checkbox" defaultChecked className="rounded bg-gray-700 border-gray-600" />
                  <div>
                    <div className="text-sm font-medium text-white">Business Data Only</div>
                    <div className="text-xs text-gray-500">Only sync data matching HubSpot contacts</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-lg cursor-pointer hover:bg-gray-800/50">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">Include Personal Context</span>
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Caution</span>
                    </div>
                    <div className="text-xs text-gray-500">Include personal SMS, calls, and location in AI context</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
