import React, { useState } from 'react';
import { Plus, DollarSign, Calendar, TrendingUp, Loader2, X, ChevronRight } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  deal_type: string;
  stage: string;
  value: number;
  recurring_value: number;
  probability: number;
  expected_close_date: number | null;
  rep_name?: string;
}

interface Props {
  clientId: string;
  deals: Deal[];
  onRefresh: () => void;
}

const STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'on_hold'];
const ACTIVE_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation'];

const STAGE_COLORS: Record<string, string> = {
  discovery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  qualification: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  proposal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  negotiation: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  on_hold: 'bg-gray-700 text-gray-400 border-gray-600',
};

const DEAL_TYPES = [
  { value: 'support_plan', label: 'Support Plan' },
  { value: 'project', label: 'Project' },
  { value: 'installation', label: 'Installation' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'training', label: 'Training' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'expansion', label: 'Expansion' },
];

const ClientDealPipeline: React.FC<Props> = ({ clientId, deals, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', deal_type: 'support_plan',
    stage: 'discovery', value: 0, probability: 50, expected_close_date: ''
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setShowForm(false);
        setFormData({ title: '', description: '', deal_type: 'support_plan', stage: 'discovery', value: 0, probability: 50, expected_close_date: '' });
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      await fetch(`/api/admin/clients/${clientId}/deals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: dealId, stage: newStage })
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update deal:', err);
    }
  };

  // Pipeline summary
  const activeDeals = deals.filter(d => ACTIVE_STAGES.includes(d.stage));
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedValue = activeDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);
  const wonDeals = deals.filter(d => d.stage === 'closed_won');
  const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="space-y-4">
      {/* Pipeline Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Pipeline Value</p>
          <p className="text-lg font-bold text-white">${totalPipelineValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Weighted Value</p>
          <p className="text-lg font-bold text-amber-400">${Math.round(weightedValue).toLocaleString()}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">Won Revenue</p>
          <p className="text-lg font-bold text-green-400">${totalWonValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Deal Pipeline</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Deal
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Title*</label>
              <input
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                placeholder="Deal name"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Type</label>
              <select
                value={formData.deal_type}
                onChange={e => setFormData(prev => ({ ...prev, deal_type: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-400">Value ($)</label>
              <input
                type="number"
                value={formData.value}
                onChange={e => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Probability (%)</label>
              <input
                type="number"
                min="0" max="100"
                value={formData.probability}
                onChange={e => setFormData(prev => ({ ...prev, probability: parseInt(e.target.value) || 0 }))}
                className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Expected Close</label>
              <input
                type="date"
                value={formData.expected_close_date}
                onChange={e => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-amber-500 text-white rounded text-sm hover:bg-amber-600 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Deal'}
            </button>
          </div>
        </form>
      )}

      {/* Pipeline Stages */}
      {deals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No deals yet. Create one to start tracking the pipeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {STAGES.filter(stage => deals.some(d => d.stage === stage)).map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage);
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STAGE_COLORS[stage]}`}>
                    {stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-xs text-gray-500">{stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-gray-600">${stageDeals.reduce((s, d) => s + (d.value || 0), 0).toLocaleString()}</span>
                </div>
                {stageDeals.map(deal => (
                  <div key={deal.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 ml-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{deal.title}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="capitalize">{deal.deal_type.replace('_', ' ')}</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />${deal.value?.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />{deal.probability}%
                          </span>
                          {deal.expected_close_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{new Date(deal.expected_close_date * 1000).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {ACTIVE_STAGES.includes(deal.stage) && (
                        <div className="flex items-center gap-1">
                          {ACTIVE_STAGES.indexOf(deal.stage) < ACTIVE_STAGES.length - 1 && (
                            <button
                              onClick={() => handleStageChange(deal.id, ACTIVE_STAGES[ACTIVE_STAGES.indexOf(deal.stage) + 1])}
                              className="p-1 text-gray-400 hover:text-amber-400 transition-colors"
                              title="Advance stage"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientDealPipeline;
