import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Filter, RefreshCw, Trash2, ChevronRight, Users,
  Loader2, X, AlertCircle, Save, Eye, Layers, UserPlus, UserMinus,
  Copy, CheckSquare, Square, ChevronDown, ChevronUp, Zap, Database
} from 'lucide-react';

// TypeScript Interfaces
export interface SegmentCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number | string[];
}

export interface SegmentConditionGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: SegmentCondition[];
}

export interface Segment {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  segment_type: 'dynamic' | 'static';
  query_json: string | null;
  cached_count: number;
  cached_at: number | null;
  status: 'active' | 'archived';
  created_at: number;
  updated_at: number;
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  pos_system: string | null;
  geographic_tier: string | null;
  status: string;
  engagement_score: number;
  tags: string[];
}

interface SegmentPreview {
  count: number;
  sample: Subscriber[];
}

// Field definitions for the query builder
const FIELD_DEFINITIONS = [
  { value: 'pos_system', label: 'POS System', type: 'select', options: ['toast', 'square', 'clover', 'lightspeed', 'aloha', 'micros', 'none', 'unknown'] },
  { value: 'geographic_tier', label: 'Geographic Tier', type: 'select', options: ['tier1', 'tier2', 'tier3', 'tier4', 'unknown'] },
  { value: 'status', label: 'Status', type: 'select', options: ['active', 'unsubscribed', 'bounced', 'complained', 'cleaned', 'pending'] },
  { value: 'engagement_score', label: 'Engagement Score', type: 'number' },
  { value: 'lead_source', label: 'Lead Source', type: 'text' },
  { value: 'tags', label: 'Tags', type: 'tags' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
  { value: 'company', label: 'Company', type: 'text' },
  { value: 'email', label: 'Email Domain', type: 'text' },
  { value: 'state', label: 'State', type: 'text' },
  { value: 'city', label: 'City', type: 'text' },
  { value: 'lead_status', label: 'Lead Status', type: 'select', options: ['new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost', 'do_not_contact'] }
];

const OPERATOR_DEFINITIONS: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'in_list', label: 'Is one of' },
    { value: 'not_in_list', label: 'Is not one of' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_than_or_equals', label: 'Greater than or equals' },
    { value: 'less_than_or_equals', label: 'Less than or equals' },
    { value: 'between', label: 'Between' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'in_last_days', label: 'In last N days' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  tags: [
    { value: 'contains', label: 'Has tag' },
    { value: 'not_contains', label: 'Does not have tag' },
    { value: 'contains_any', label: 'Has any of tags' },
    { value: 'contains_all', label: 'Has all of tags' },
    { value: 'is_empty', label: 'Has no tags' },
    { value: 'is_not_empty', label: 'Has any tag' }
  ]
};

const SegmentBuilder: React.FC = () => {
  // List state
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [editorName, setEditorName] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorType, setEditorType] = useState<'dynamic' | 'static'>('dynamic');
  const [conditionGroups, setConditionGroups] = useState<SegmentConditionGroup[]>([]);
  const [groupLogic, setGroupLogic] = useState<'AND' | 'OR'>('AND');
  const [isSaving, setIsSaving] = useState(false);

  // Preview state
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Static segment member selection
  const [staticMembers, setStaticMembers] = useState<Set<string>>(new Set());
  const [availableSubscribers, setAvailableSubscribers] = useState<Subscriber[]>([]);
  const [subscriberSearchQuery, setSubscriberSearchQuery] = useState('');
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);

  // Load segments on mount
  useEffect(() => {
    loadSegments();
  }, []);

  const loadSegments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);

      const response = await fetch(`/api/admin/email/segments?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSegments(result.data || []);
      } else {
        setError(result.error || 'Failed to load segments');
      }
    } catch (err) {
      console.error('Failed to load segments:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscribersForStatic = async (search = '') => {
    setIsLoadingSubscribers(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.append('search', search);

      const response = await fetch(`/api/admin/email/subscribers?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setAvailableSubscribers(result.data.map((s: any) => ({
          ...s,
          tags: s.tags ? (typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags) : []
        })));
      }
    } catch (err) {
      console.error('Failed to load subscribers:', err);
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const loadSegmentMembers = async (segmentId: string) => {
    try {
      const response = await fetch(`/api/admin/email/segments/${segmentId}/members`);
      const result = await response.json();

      if (result.success) {
        setStaticMembers(new Set(result.data.map((m: any) => m.subscriber_id)));
      }
    } catch (err) {
      console.error('Failed to load segment members:', err);
    }
  };

  // Filter segments
  const filteredSegments = useMemo(() => {
    return segments.filter(seg => {
      const matchesSearch = seg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (seg.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || seg.segment_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [segments, searchQuery, filterType]);

  // Create new condition
  const createCondition = (): SegmentCondition => ({
    id: crypto.randomUUID(),
    field: 'pos_system',
    operator: 'equals',
    value: ''
  });

  // Create new condition group
  const createConditionGroup = (): SegmentConditionGroup => ({
    id: crypto.randomUUID(),
    logic: 'AND',
    conditions: [createCondition()]
  });

  // Initialize editor for new segment
  const handleCreateNew = () => {
    setEditingSegment(null);
    setEditorName('');
    setEditorDescription('');
    setEditorType('dynamic');
    setConditionGroups([createConditionGroup()]);
    setGroupLogic('AND');
    setPreview(null);
    setStaticMembers(new Set());
    setShowEditor(true);
  };

  // Initialize editor for existing segment
  const handleEditSegment = async (segment: Segment) => {
    setEditingSegment(segment);
    setEditorName(segment.name);
    setEditorDescription(segment.description || '');
    setEditorType(segment.segment_type);

    if (segment.query_json) {
      try {
        const query = JSON.parse(segment.query_json);
        if (query.groups && Array.isArray(query.groups)) {
          setConditionGroups(query.groups);
          setGroupLogic(query.logic || 'AND');
        } else if (query.conditions && Array.isArray(query.conditions)) {
          // Legacy format: single group of conditions
          setConditionGroups([{
            id: crypto.randomUUID(),
            logic: 'AND',
            conditions: query.conditions
          }]);
          setGroupLogic('AND');
        } else {
          setConditionGroups([createConditionGroup()]);
          setGroupLogic('AND');
        }
      } catch (e) {
        setConditionGroups([createConditionGroup()]);
        setGroupLogic('AND');
      }
    } else {
      setConditionGroups([createConditionGroup()]);
      setGroupLogic('AND');
    }

    if (segment.segment_type === 'static') {
      await loadSegmentMembers(segment.id);
      await loadSubscribersForStatic('');
    }

    setPreview(null);
    setShowEditor(true);
  };

  // Add condition to group
  const handleAddCondition = (groupId: string) => {
    setConditionGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, conditions: [...group.conditions, createCondition()] }
          : group
      )
    );
  };

  // Remove condition from group
  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    setConditionGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, conditions: group.conditions.filter(c => c.id !== conditionId) }
          : group
      ).filter(group => group.conditions.length > 0)
    );
  };

  // Update condition
  const handleUpdateCondition = (groupId: string, conditionId: string, updates: Partial<SegmentCondition>) => {
    setConditionGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              conditions: group.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              )
            }
          : group
      )
    );
  };

  // Add condition group
  const handleAddGroup = () => {
    setConditionGroups(groups => [...groups, createConditionGroup()]);
  };

  // Remove condition group
  const handleRemoveGroup = (groupId: string) => {
    setConditionGroups(groups => groups.filter(g => g.id !== groupId));
  };

  // Update group logic
  const handleUpdateGroupLogic = (groupId: string, logic: 'AND' | 'OR') => {
    setConditionGroups(groups =>
      groups.map(group =>
        group.id === groupId ? { ...group, logic } : group
      )
    );
  };

  // Preview segment
  const handlePreview = async () => {
    if (editorType === 'static') {
      setPreview({
        count: staticMembers.size,
        sample: availableSubscribers.filter(s => staticMembers.has(s.id)).slice(0, 10)
      });
      return;
    }

    setIsPreviewLoading(true);
    try {
      const query = {
        logic: groupLogic,
        groups: conditionGroups
      };

      const response = await fetch('/api/admin/email/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const result = await response.json();

      if (result.success) {
        setPreview(result.data);
      } else {
        setError(result.error || 'Failed to preview segment');
      }
    } catch (err) {
      setError('Failed to preview segment');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Save segment
  const handleSave = async () => {
    if (!editorName.trim()) {
      setError('Segment name is required');
      return;
    }

    setIsSaving(true);
    try {
      const query = editorType === 'dynamic' ? {
        logic: groupLogic,
        groups: conditionGroups
      } : null;

      const payload = {
        name: editorName.trim(),
        description: editorDescription.trim() || null,
        segment_type: editorType,
        query_json: query ? JSON.stringify(query) : null
      };

      let response;
      if (editingSegment) {
        response = await fetch(`/api/admin/email/segments/${editingSegment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/admin/email/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();

      if (result.success) {
        // For static segments, update members
        if (editorType === 'static' && result.data?.id) {
          await fetch(`/api/admin/email/segments/${result.data.id}/members`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriber_ids: Array.from(staticMembers) })
          });
        }

        setShowEditor(false);
        setEditingSegment(null);
        loadSegments();
      } else {
        setError(result.error || 'Failed to save segment');
      }
    } catch (err) {
      setError('Failed to save segment');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete segment
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment? This cannot be undone.')) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/segments/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setSegments(prev => prev.filter(s => s.id !== id));
      } else {
        setError(result.error || 'Failed to delete segment');
      }
    } catch (err) {
      setError('Failed to delete segment');
    } finally {
      setActionLoading(null);
    }
  };

  // Refresh segment membership
  const handleRefresh = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/segments/${id}/refresh`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setSegments(prev => prev.map(s =>
          s.id === id ? { ...s, cached_count: result.data.count, cached_at: Math.floor(Date.now() / 1000) } : s
        ));
      } else {
        setError(result.error || 'Failed to refresh segment');
      }
    } catch (err) {
      setError('Failed to refresh segment');
    } finally {
      setActionLoading(null);
    }
  };

  // Duplicate segment
  const handleDuplicate = async (segment: Segment) => {
    setActionLoading(segment.id);
    try {
      const payload = {
        name: `${segment.name} (Copy)`,
        description: segment.description,
        segment_type: segment.segment_type,
        query_json: segment.query_json
      };

      const response = await fetch('/api/admin/email/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        loadSegments();
      } else {
        setError(result.error || 'Failed to duplicate segment');
      }
    } catch (err) {
      setError('Failed to duplicate segment');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle static member
  const toggleStaticMember = (subscriberId: string) => {
    setStaticMembers(prev => {
      const next = new Set(prev);
      if (next.has(subscriberId)) {
        next.delete(subscriberId);
      } else {
        next.add(subscriberId);
      }
      return next;
    });
  };

  // Get field definition
  const getFieldDef = (fieldValue: string) => {
    return FIELD_DEFINITIONS.find(f => f.value === fieldValue) || FIELD_DEFINITIONS[0];
  };

  // Format date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get type badge
  const getTypeBadge = (type: string) => {
    const config = type === 'dynamic'
      ? { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <Zap className="w-3 h-3" /> }
      : { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Database className="w-3 h-3" /> };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bg} ${config.text}`}>
        {config.icon}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Render condition input
  const renderConditionValue = (groupId: string, condition: SegmentCondition, fieldDef: typeof FIELD_DEFINITIONS[0]) => {
    const operator = condition.operator;

    // No value needed for these operators
    if (['is_empty', 'is_not_empty'].includes(operator)) {
      return null;
    }

    // Select field with options
    if (fieldDef.type === 'select' && fieldDef.options) {
      if (['in_list', 'not_in_list'].includes(operator)) {
        return (
          <div className="flex flex-wrap gap-1">
            {fieldDef.options.map(opt => (
              <button
                key={opt}
                onClick={() => {
                  const current = Array.isArray(condition.value) ? condition.value : [];
                  const updated = current.includes(opt)
                    ? current.filter(v => v !== opt)
                    : [...current, opt];
                  handleUpdateCondition(groupId, condition.id, { value: updated });
                }}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  (Array.isArray(condition.value) && condition.value.includes(opt))
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      }

      return (
        <select
          value={condition.value as string}
          onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
          className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Select...</option>
          {fieldDef.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Number field
    if (fieldDef.type === 'number') {
      if (operator === 'between') {
        const values = Array.isArray(condition.value) ? condition.value : ['', ''];
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={values[0] || ''}
              onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: [e.target.value, values[1] || ''] })}
              placeholder="Min"
              className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-gray-500">and</span>
            <input
              type="number"
              value={values[1] || ''}
              onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: [values[0] || '', e.target.value] })}
              placeholder="Max"
              className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        );
      }

      return (
        <input
          type="number"
          value={condition.value as number}
          onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
          placeholder="Enter value..."
          className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      );
    }

    // Date field
    if (fieldDef.type === 'date') {
      if (operator === 'in_last_days') {
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={condition.value as number}
              onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
              placeholder="30"
              className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-gray-400">days</span>
          </div>
        );
      }

      if (operator === 'between') {
        const values = Array.isArray(condition.value) ? condition.value : ['', ''];
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={values[0] || ''}
              onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: [e.target.value, values[1] || ''] })}
              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-gray-500">and</span>
            <input
              type="date"
              value={values[1] || ''}
              onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: [values[0] || '', e.target.value] })}
              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        );
      }

      return (
        <input
          type="date"
          value={condition.value as string}
          onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
          className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      );
    }

    // Tags field
    if (fieldDef.type === 'tags') {
      if (['contains_any', 'contains_all'].includes(operator)) {
        return (
          <input
            type="text"
            value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
            onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value.split(',').map(t => t.trim()) })}
            placeholder="tag1, tag2, tag3"
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        );
      }

      return (
        <input
          type="text"
          value={condition.value as string}
          onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
          placeholder="Enter tag..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={condition.value as string}
        onChange={(e) => handleUpdateCondition(groupId, condition.id, { value: e.target.value })}
        placeholder="Enter value..."
        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Subscriber Segments
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {segments.length} total segments{filteredSegments.length !== segments.length ? ` (${filteredSegments.length} shown)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSegments}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Segment
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search segments by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Types</option>
            <option value="dynamic">Dynamic</option>
            <option value="static">Static</option>
          </select>
        </div>
      </div>

      {/* Segments Table */}
      {filteredSegments.length > 0 ? (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Segment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" /> Members
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredSegments.map((segment) => (
                  <tr key={segment.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Layers className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <button
                            onClick={() => handleEditSegment(segment)}
                            className="text-white font-medium hover:text-amber-400 transition-colors text-left"
                          >
                            {segment.name}
                          </button>
                          {segment.description && (
                            <p className="text-gray-500 text-xs truncate max-w-[250px]">
                              {segment.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getTypeBadge(segment.segment_type)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white font-medium">
                        {segment.cached_count.toLocaleString()}
                      </span>
                      {segment.cached_at && (
                        <span className="text-gray-500 text-xs block">
                          {formatDate(segment.cached_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatDate(segment.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {actionLoading === segment.id ? (
                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleRefresh(segment.id)}
                              className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                              title="Refresh Count"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(segment)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                              title="Duplicate"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(segment.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditSegment(segment)}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                              title="Edit"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="admin-card p-12 text-center">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Segments Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create segments to organize your subscribers'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Segment
            </button>
          )}
        </div>
      )}

      {/* Segment Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="admin-card w-full max-w-4xl mx-4">
            {/* Editor Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingSegment ? 'Edit Segment' : 'Create New Segment'}
              </h3>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Segment Name *</label>
                  <input
                    type="text"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    placeholder="e.g., Toast Users - High Engagement"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Segment Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditorType('dynamic')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        editorType === 'dynamic'
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                          : 'bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Dynamic
                    </button>
                    <button
                      onClick={() => {
                        setEditorType('static');
                        loadSubscribersForStatic('');
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        editorType === 'static'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      Static
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={editorDescription}
                  onChange={(e) => setEditorDescription(e.target.value)}
                  placeholder="Describe this segment..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Dynamic Segment - Query Builder */}
              {editorType === 'dynamic' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Conditions</label>
                    {conditionGroups.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Match</span>
                        <select
                          value={groupLogic}
                          onChange={(e) => setGroupLogic(e.target.value as 'AND' | 'OR')}
                          className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white"
                        >
                          <option value="AND">ALL groups</option>
                          <option value="OR">ANY group</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {conditionGroups.map((group, groupIndex) => (
                    <div key={group.id} className="border border-gray-700 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Group {groupIndex + 1}</span>
                          {group.conditions.length > 1 && (
                            <select
                              value={group.logic}
                              onChange={(e) => handleUpdateGroupLogic(group.id, e.target.value as 'AND' | 'OR')}
                              className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white"
                            >
                              <option value="AND">Match ALL</option>
                              <option value="OR">Match ANY</option>
                            </select>
                          )}
                        </div>
                        {conditionGroups.length > 1 && (
                          <button
                            onClick={() => handleRemoveGroup(group.id)}
                            className="p-1 text-gray-500 hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {group.conditions.map((condition, condIndex) => {
                        const fieldDef = getFieldDef(condition.field);
                        const operators = OPERATOR_DEFINITIONS[fieldDef.type] || OPERATOR_DEFINITIONS.text;

                        return (
                          <div key={condition.id} className="flex flex-wrap items-start gap-2">
                            {condIndex > 0 && (
                              <span className="px-2 py-2 text-xs text-gray-500 font-medium">
                                {group.logic}
                              </span>
                            )}

                            {/* Field Select */}
                            <select
                              value={condition.field}
                              onChange={(e) => {
                                const newField = getFieldDef(e.target.value);
                                const newOperators = OPERATOR_DEFINITIONS[newField.type] || OPERATOR_DEFINITIONS.text;
                                handleUpdateCondition(group.id, condition.id, {
                                  field: e.target.value,
                                  operator: newOperators[0].value,
                                  value: ''
                                });
                              }}
                              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              {FIELD_DEFINITIONS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>

                            {/* Operator Select */}
                            <select
                              value={condition.operator}
                              onChange={(e) => handleUpdateCondition(group.id, condition.id, { operator: e.target.value })}
                              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              {operators.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>

                            {/* Value Input */}
                            {renderConditionValue(group.id, condition, fieldDef)}

                            {/* Remove Condition */}
                            <button
                              onClick={() => handleRemoveCondition(group.id, condition.id)}
                              className="p-2 text-gray-500 hover:text-red-400"
                              title="Remove condition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => handleAddCondition(group.id)}
                        className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                      >
                        <Plus className="w-3 h-3" />
                        Add Condition
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleAddGroup}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Condition Group
                  </button>
                </div>
              )}

              {/* Static Segment - Subscriber Selection */}
              {editorType === 'static' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">
                      Select Subscribers ({staticMembers.size} selected)
                    </label>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search subscribers..."
                      value={subscriberSearchQuery}
                      onChange={(e) => {
                        setSubscriberSearchQuery(e.target.value);
                        loadSubscribersForStatic(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Subscriber List */}
                  <div className="border border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                    {isLoadingSubscribers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                      </div>
                    ) : availableSubscribers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No subscribers found
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-700/50">
                        {availableSubscribers.map(subscriber => (
                          <div
                            key={subscriber.id}
                            onClick={() => toggleStaticMember(subscriber.id)}
                            className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                              staticMembers.has(subscriber.id) ? 'bg-amber-500/10' : ''
                            }`}
                          >
                            {staticMembers.has(subscriber.id) ? (
                              <CheckSquare className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{subscriber.email}</p>
                              <p className="text-gray-500 text-xs truncate">
                                {subscriber.company || subscriber.first_name || '-'}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">{subscriber.pos_system || '-'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Section */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-300">Preview</h4>
                  <button
                    onClick={handlePreview}
                    disabled={isPreviewLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    {isPreviewLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    Preview Matches
                  </button>
                </div>

                {preview && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-medium">{preview.count.toLocaleString()}</span>
                      <span className="text-gray-400">matching subscribers</span>
                    </div>

                    {preview.sample.length > 0 && (
                      <div className="bg-gray-900/50 rounded-lg overflow-hidden">
                        <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-700">
                          Sample (first 10)
                        </div>
                        <div className="divide-y divide-gray-700/50">
                          {preview.sample.map(s => (
                            <div key={s.id} className="px-3 py-2 flex items-center justify-between">
                              <span className="text-sm text-white">{s.email}</span>
                              <span className="text-xs text-gray-500">{s.pos_system || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Editor Footer */}
            <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editorName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingSegment ? 'Save Changes' : 'Create Segment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentBuilder;
