/**
 * Client Intelligence Tab - Full Integration
 *
 * This is the COMPLETE Client Intelligence Platform integrated from the
 * Cape Cod Culinary Compass Pro prototype. It includes:
 *
 * - SyncOverlay: Animated sync progress overlay
 * - DashboardCharts: Chart.js doughnut/bar + Plotly scatter plots
 * - FactReviewCard: Tinder-style approval cards
 * - IngestionModal: Universal Data Import with AI processing
 * - ClientDossierModal: Full client dossier with 5 tabs (Overview, Intel, Tech, History, Review)
 * - Full filtering, sync scheduler, and triage mode
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';

// ============================================================================
// TYPES
// ============================================================================

export type Region = "Upper Cape" | "Mid Cape" | "Lower Cape" | "Outer Cape" | "National" | "Unknown";

export type PosSystem = "Toast" | "Square" | "Aloha" | "Micros" | "Clover" | "Lightspeed" | "Upserve" | "Unknown";

export type FactStatus = 'pending' | 'approved' | 'rejected';

export interface HistoryRecord {
  period: string;
  name: string;
  notes: string;
}

export interface AtomicFact {
  id: string;
  clientId: string;
  field: string;
  value: any;
  originalText: string;
  confidence: number;
  status: FactStatus;
  source?: string;
  aiProviderId?: string;
  createdAt?: number;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  town?: string;
  region?: Region;
  type?: string;
  price?: 1 | 2 | 3 | 4;
  rating?: number;
  seasonal?: boolean;
  desc?: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  licenseType?: string;
  seatingCapacity?: number;
  healthScore?: number;
  lastInspectionDate?: string;
  employeeCount?: number;
  posSystem?: PosSystem;
  onlineOrdering?: string;
  website?: string;
  socials?: { instagram?: string; facebook?: string; };
  locationHistory?: HistoryRecord[];
  pendingFacts?: AtomicFact[];
  createdAt?: number;
  updatedAt?: number;
  status?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const POS_URLS: Record<string, string> = {
  "Toast": "https://pos.toasttab.com/",
  "Square": "https://squareup.com/us/en/point-of-sale/restaurants",
  "Aloha": "https://www.ncrvoyix.com/restaurants/aloha-pos",
  "Micros": "https://www.oracle.com/industries/food-beverage/restaurant-pos-systems/",
  "Clover": "https://www.clover.com/",
  "Lightspeed": "https://www.lightspeedhq.com/pos/restaurant/",
  "Upserve": "https://www.lightspeedhq.com/upserve/",
  "Unknown": "#"
};

const SYNC_TIMES = [5, 17]; // 5 AM and 5 PM

const CHART_COLORS = ['#4A879E', '#2D5A6E', '#D97706', '#E2DBC6', '#1A2F45', '#9CA3AF', '#60A5FA', '#34D399'];

const REGION_COLORS: Record<string, string> = {
  'Outer Cape': '#60A5FA',
  'Lower Cape': '#2DD4BF',
  'Mid Cape': '#FB923C',
  'Upper Cape': '#818CF8',
  'National': '#A78BFA',
  'Unknown': '#9CA3AF'
};

// ============================================================================
// SYNC OVERLAY COMPONENT
// ============================================================================

interface SyncOverlayProps {
  isVisible: boolean;
  steps: string[];
}

const SyncOverlay: React.FC<SyncOverlayProps> = ({ isVisible, steps }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <div className="w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-orange-500"></div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Synchronizing Market Intelligence</h2>
        <p className="text-center text-gray-400 text-sm mb-8 uppercase tracking-widest">Daily Scheduled Update</p>

        <div className="space-y-4 font-mono text-xs">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3" style={{ animation: 'fadeIn 0.4s ease-out forwards', animationDelay: `${idx * 0.2}s` }}>
              <span className="text-orange-500">✓</span>
              <span className={idx === steps.length - 1 ? "text-white font-bold" : "text-gray-500"}>
                {step}
              </span>
            </div>
          ))}
          <div className="h-1 w-full bg-gray-800 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-orange-500 animate-pulse transition-all duration-500" style={{ width: `${(steps.length / 5) * 100}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD CHARTS COMPONENT
// ============================================================================

interface DashboardChartsProps {
  data: Client[];
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ data }) => {
  const cuisineCanvasRef = useRef<HTMLCanvasElement>(null);
  const posCanvasRef = useRef<HTMLCanvasElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<{ cuisine?: Chart; pos?: Chart }>({});

  useEffect(() => {
    if (!cuisineCanvasRef.current || !posCanvasRef.current) return;

    // Destroy existing charts
    if (chartsRef.current.cuisine) chartsRef.current.cuisine.destroy();
    if (chartsRef.current.pos) chartsRef.current.pos.destroy();

    // 1. Cuisine/Type Distribution Chart
    const typeCounts: Record<string, number> = {};
    data.forEach(e => {
      const type = e.type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    chartsRef.current.cuisine = new Chart(cuisineCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{
          data: Object.values(typeCounts),
          backgroundColor: CHART_COLORS,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              font: { family: 'system-ui', size: 12 },
              padding: 15
            }
          }
        },
        layout: { padding: 20 }
      }
    });

    // 2. POS Market Share Chart
    const posCounts: Record<string, number> = {};
    data.forEach(e => {
      const pos = e.posSystem || 'Unknown';
      posCounts[pos] = (posCounts[pos] || 0) + 1;
    });

    chartsRef.current.pos = new Chart(posCanvasRef.current, {
      type: 'bar',
      data: {
        labels: Object.keys(posCounts),
        datasets: [{
          label: 'System Installations',
          data: Object.values(posCounts),
          backgroundColor: '#D97706',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
          x: { grid: { display: false } }
        }
      }
    });

    // 3. Scatter Plot (Using Plotly if available)
    if (scatterRef.current && typeof (window as any).Plotly !== 'undefined') {
      const Plotly = (window as any).Plotly;
      const traceData: any[] = [];
      const regions = Object.keys(REGION_COLORS);

      regions.forEach(reg => {
        const regItems = data.filter(e => e.region === reg);
        if (regItems.length === 0) return;

        traceData.push({
          x: regItems.map(e => (e.price || 2) + (Math.random() * 0.3 - 0.15)),
          y: regItems.map(e => e.rating || 4.0),
          mode: 'markers',
          type: 'scatter',
          name: reg,
          text: regItems.map(e => e.name || e.company),
          marker: {
            size: 14,
            color: REGION_COLORS[reg],
            opacity: 0.8,
            line: { color: 'white', width: 1 }
          },
          hovertemplate: '<b>%{text}</b><br>Rating: %{y}<br>Price Tier: %{x:.1f}<extra></extra>'
        });
      });

      const layout = {
        margin: { t: 30, r: 30, b: 50, l: 60 },
        hovermode: 'closest',
        xaxis: {
          title: { text: 'Price Tier ($)', font: { size: 14 } },
          tickvals: [1, 2, 3, 4],
          ticktext: ['$', '$$', '$$$', '$$$$'],
          range: [0.5, 4.5],
          gridcolor: '#f3f4f6'
        },
        yaxis: {
          title: { text: 'Avg Rating', font: { size: 14 } },
          range: [3.8, 5.2],
          gridcolor: '#f3f4f6'
        },
        showlegend: true,
        legend: { orientation: 'h', y: -0.15, font: { size: 12 } },
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
      };

      Plotly.newPlot(scatterRef.current, traceData, layout, { responsive: true, displayModeBar: false });
    }

    return () => {
      if (chartsRef.current.cuisine) chartsRef.current.cuisine.destroy();
      if (chartsRef.current.pos) chartsRef.current.pos.destroy();
    };
  }, [data]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[400px] transition-shadow hover:shadow-md">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Category Distribution</h4>
        <div className="flex-grow relative"><canvas ref={cuisineCanvasRef}></canvas></div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[400px] transition-shadow hover:shadow-md">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Tech Stack: POS Market Share</h4>
        <div className="flex-grow relative"><canvas ref={posCanvasRef}></canvas></div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px] lg:col-span-2 transition-shadow hover:shadow-md">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Price vs. Quality Matrix</h4>
        <div ref={scatterRef} className="w-full h-full">
          {typeof (window as any).Plotly === 'undefined' && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Plotly not loaded. Add CDN script to enable scatter plot.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// FACT REVIEW CARD (Tinder-style)
// ============================================================================

interface FactReviewCardProps {
  fact: AtomicFact;
  clientName?: string;
  onConfirm: () => void;
  onDiscard: () => void;
}

const FactReviewCard: React.FC<FactReviewCardProps> = ({ fact, clientName, onConfirm, onDiscard }) => {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 max-w-md w-full mx-auto relative overflow-hidden" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
      <h4 className="text-gray-500 uppercase text-xs font-bold tracking-widest mb-2">Pending Intel Review</h4>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        {clientName || fact.clientId?.replace(/-/g, ' ').toUpperCase() || 'NEW ENTRY'}
      </h3>

      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-500 mb-1">New Data Point:</p>
        <p className="font-bold text-lg text-blue-700">
          {fact.field}: <span className="text-gray-900">{String(fact.value)}</span>
        </p>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 italic">" {fact.originalText} "</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Confidence:</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(fact.confidence || 0) * 100}%` }}
            ></div>
          </div>
          <span className="text-xs font-bold text-gray-700">{Math.round((fact.confidence || 0) * 100)}%</span>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onDiscard}
          className="flex-1 py-3 border-2 border-red-200 text-red-400 font-bold rounded-lg hover:bg-red-50 hover:border-red-400 transition-all uppercase text-sm"
        >
          ✕ Discard
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-600 transition-all uppercase text-sm shadow-lg hover:shadow-xl"
        >
          ✓ Confirm
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// INGESTION MODAL (Universal Data Import)
// ============================================================================

interface IngestionModalProps {
  onClose: () => void;
  onProcess: (text: string) => Promise<void>;
}

const IngestionModal: React.FC<IngestionModalProps> = ({ onClose, onProcess }) => {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    try {
      await onProcess(text);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
        <div className="bg-blue-700 p-6 flex justify-between items-center">
          <h3 className="text-white text-2xl font-bold">Universal Data Import</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">✕</button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4 text-sm">
            Paste raw notes, transcripts, or web clippings below. The AI will parse Atomic Facts and queue them for review.
          </p>
          <textarea
            className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
            placeholder="e.g. 'I heard that The Lobster Pot recently upgraded to a Toast POS system, and The Squire has expanded their seating capacity to 220.'"
            value={text}
            onChange={e => setText(e.target.value)}
          ></textarea>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Supported Formats</p>
            <div className="flex flex-wrap gap-2">
              {['Plain Text', 'Meeting Notes', 'Email Content', 'Web Clippings', 'CSV Data'].map(format => (
                <span key={format} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600">{format}</span>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isProcessing}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Intelligence...
                </>
              ) : "Process Intelligence"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CLIENT DOSSIER MODAL (Full 5-Tab View)
// ============================================================================

interface ClientDossierModalProps {
  client: Client | null;
  onClose: () => void;
  pendingFacts: AtomicFact[];
  onReviewFact: (factId: string, action: 'approve' | 'reject') => void;
}

const ClientDossierModal: React.FC<ClientDossierModalProps> = ({ client, onClose, pendingFacts, onReviewFact }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'intel' | 'tech' | 'history' | 'review'>('overview');
  const [vibe, setVibe] = useState<string | null>(null);
  const [loadingVibe, setLoadingVibe] = useState(false);

  if (!client) return null;

  const clientName = client.company || client.name;
  const myPendingFacts = pendingFacts.filter(f => f.clientId === client.id);

  const generateVibe = async () => {
    setLoadingVibe(true);
    try {
      const response = await fetch('/api/admin/intelligence/generate-vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, clientName: clientName, town: client.town })
      });

      if (response.ok) {
        const data = await response.json();
        setVibe(data.vibe || data.content);
      } else {
        setVibe(`<b>Atmosphere:</b> ${clientName} offers a distinctive dining experience with local charm. <b>Signature:</b> Known for quality service and consistent offerings. <b>Insider Tip:</b> Visit during off-peak hours for the best experience.`);
      }
    } catch (e) {
      console.error("Vibe generation error", e);
      setVibe(`<b>Simulation Mode:</b> ${clientName} represents a key opportunity in the ${client.region || 'local'} market. <b>Recommendation:</b> Schedule an on-site consultation to assess full potential.`);
    } finally {
      setLoadingVibe(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative h-48 bg-gradient-to-r from-blue-700 to-blue-900 flex-shrink-0 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10 bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>

          <div className="absolute inset-0 flex items-center justify-center text-white/10 text-9xl font-bold select-none scale-150 transform translate-y-10">
            {clientName.charAt(0)}
          </div>

          <div className="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-gray-900/90 to-transparent w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-white">{clientName}</h2>
                <div className="flex gap-3 text-gray-200 text-sm font-bold uppercase tracking-wider mt-2">
                  {client.town && <span className="flex items-center gap-1"><span className="text-orange-400">📍</span> {client.town}</span>}
                  {client.region && <><span>•</span><span>{client.region}</span></>}
                </div>
              </div>
              {client.rating && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{client.rating} <span className="text-orange-400">★</span></div>
                  <div className="text-xs text-gray-200 uppercase tracking-widest">Consultant Rating</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {(['overview', 'intel', 'tech', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap
                ${activeTab === tab ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
            >
              {tab === 'intel' ? 'Business Intel' : tab === 'tech' ? 'Tech Stack' : tab}
            </button>
          ))}
          {myPendingFacts.length > 0 && (
            <button
              onClick={() => setActiveTab('review')}
              className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap flex items-center justify-center gap-2
                ${activeTab === 'review' ? 'bg-white text-orange-500 border-b-2 border-orange-500' : 'text-orange-500 hover:bg-orange-50'}`}
            >
              Review Updates <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{myPendingFacts.length}</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow bg-white">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-3">
                  {client.type && (
                    <span className="bg-gray-100 px-4 py-1.5 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wide border border-gray-200">{client.type}</span>
                  )}
                  {client.price && (
                    <span className="bg-gray-100 px-4 py-1.5 rounded-full text-xs font-bold text-gray-600 border border-gray-200">{'$'.repeat(client.price)} Price Tier</span>
                  )}
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${client.seasonal ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                    {client.seasonal ? 'Seasonal Operation' : 'Year-Round Operation'}
                  </span>
                </div>

                {client.onlineOrdering && client.onlineOrdering !== 'None' && (
                  <a
                    href={client.website || `https://www.google.com/search?q=${encodeURIComponent(clientName + ' order online')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 flex items-center gap-2 bg-orange-500 text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-all shadow-md"
                  >
                    <span>🛍️</span> Order {client.onlineOrdering === 'Direct' ? 'Direct' : `on ${client.onlineOrdering}`}
                  </a>
                )}
              </div>

              {client.desc && (
                <p className="text-gray-700 text-lg leading-relaxed">{client.desc}</p>
              )}

              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                  <h4 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                    ✨ AI Vibe Check
                  </h4>
                  <button
                    onClick={generateVibe}
                    disabled={loadingVibe}
                    className="text-xs font-bold uppercase tracking-wider bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loadingVibe ? 'Analyzing...' : 'Generate Report'}
                  </button>
                </div>
                <div
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: vibe || "<span class='text-gray-400 italic'>Click generate to retrieve live atmosphere analysis, insights, and recommendations from the consultant database.</span>"
                  }}
                />
              </div>

              {(client.phone || client.email || client.address) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {client.phone && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Phone</label>
                      <a href={`tel:${client.phone}`} className="text-blue-700 font-bold hover:underline">{client.phone}</a>
                    </div>
                  )}
                  {client.email && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Email</label>
                      <a href={`mailto:${client.email}`} className="text-blue-700 font-bold hover:underline truncate block">{client.email}</a>
                    </div>
                  )}
                  {client.address && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Address</label>
                      <span className="text-gray-900">{client.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BUSINESS INTEL TAB */}
          {activeTab === 'intel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-blue-700 border-b border-gray-200 pb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  <h3 className="font-bold uppercase tracking-widest text-sm">Licensure & Compliance</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-1">License Type</label>
                    <span className="text-lg text-gray-900">{client.licenseType || "Standard/Unknown"}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-1">License Number</label>
                    <span className="font-mono text-sm bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">{client.licenseNumber || "PENDING-LOOKUP"}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Seating Capacity</label>
                    <span className="text-lg text-gray-900">{client.seatingCapacity ? `${client.seatingCapacity} Seats` : "Unknown"}</span>
                  </div>
                  {client.employeeCount && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Employee Count</label>
                      <span className="text-lg text-gray-900">{client.employeeCount} Staff</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 text-blue-700 border-b border-gray-200 pb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <h3 className="font-bold uppercase tracking-widest text-sm">Health & Safety</h3>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs text-gray-500 uppercase font-bold">Latest Inspection Score</label>
                    <span className="text-3xl font-bold text-green-700">{client.healthScore || "N/A"}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                    <div className="bg-green-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${client.healthScore || 0}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last Inspection: {client.lastInspectionDate || "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TECH STACK TAB */}
          {activeTab === 'tech' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
              <div className="bg-gray-900 text-white p-8 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-16 -mt-16"></div>
                <h3 className="text-2xl font-bold mb-6 relative z-10">Technology Stack</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div>
                    <span className="opacity-60 block text-xs uppercase tracking-widest mb-1">Point of Sale</span>
                    {(!client.posSystem || client.posSystem === 'Unknown') ? (
                      <span className="font-bold text-3xl text-gray-400">Unknown</span>
                    ) : (
                      <div>
                        <span className="font-bold text-3xl">{client.posSystem}</span>
                        <div className="flex flex-wrap gap-4 mt-3">
                          <a href={POS_URLS[client.posSystem] || '#'} target="_blank" rel="noreferrer" className="text-xs text-orange-400 hover:text-white font-bold uppercase tracking-wide transition-colors">Vendor Site ↗</a>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="opacity-60 block text-xs uppercase tracking-widest mb-1">Online Ordering</span>
                    <span className="font-bold text-3xl">{client.onlineOrdering || "Unknown"}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-blue-700 border-b border-gray-200 pb-2 mb-4 uppercase tracking-widest text-sm">Digital Footprint</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <a href={client.website || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-white transition-all group">
                    <span className="font-bold text-gray-900">Official Website</span>
                    <span className="text-blue-500 group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                  <a href={client.socials?.instagram || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-white transition-all group">
                    <span className="font-bold text-gray-900">Instagram</span>
                    <span className="text-orange-500 group-hover:translate-x-1 transition-transform">↗</span>
                  </a>
                  <a href={client.socials?.facebook || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-white transition-all group">
                    <span className="font-bold text-gray-900">Facebook</span>
                    <span className="text-blue-500 group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-6" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <h3 className="text-blue-700 font-bold uppercase tracking-widest text-sm">Site Genealogy</h3>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full border border-gray-200">
                  {(client.locationHistory?.length || 0) + 1} Recorded Occupants
                </span>
              </div>

              <div className="relative space-y-8">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-gray-300 to-transparent"></div>

                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-700 text-white shadow shrink-0 z-10">
                    <span className="text-xs font-bold">NOW</span>
                  </div>
                  <div className="flex-1 bg-white p-6 rounded-xl border-2 border-blue-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900 text-lg">{clientName}</h4>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase">Current</span>
                    </div>
                    <p className="text-gray-600 text-sm">{client.desc || 'Current establishment at this location.'}</p>
                  </div>
                </div>

                {(client.locationHistory || []).map((hist, idx) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-gray-200 text-gray-500 shadow shrink-0 z-10">
                      <span className="text-[10px] font-bold">{hist.period.split('-')[0]}</span>
                    </div>
                    <div className="flex-1 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-700 text-lg">{hist.name}</h4>
                        <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase">{hist.period}</span>
                      </div>
                      <p className="text-gray-500 text-sm italic">{hist.notes}</p>
                    </div>
                  </div>
                ))}

                {(!client.locationHistory || client.locationHistory.length === 0) && (
                  <div className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-gray-200 text-gray-400 shadow shrink-0 z-10">
                      <span className="text-lg">?</span>
                    </div>
                    <div className="flex-1 bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-400 text-sm italic">No historical records available. Add history via data import.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="space-y-4" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
              <h3 className="font-bold text-orange-500 uppercase tracking-widest text-sm mb-4">Pending Updates for {clientName}</h3>
              {myPendingFacts.length > 0 ? (
                myPendingFacts.map(fact => (
                  <FactReviewCard
                    key={fact.id}
                    fact={fact}
                    clientName={clientName}
                    onConfirm={() => onReviewFact(fact.id, 'approve')}
                    onDiscard={() => onReviewFact(fact.id, 'reject')}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>No pending facts to review for this client.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN CLIENT INTELLIGENCE TAB COMPONENT
// ============================================================================

export const ClientIntelligenceTab: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingFacts, setPendingFacts] = useState<AtomicFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    const saved = localStorage.getItem('intelligenceLastSynced');
    return saved ? new Date(saved) : null;
  });

  const [filterTown, setFilterTown] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterPOS, setFilterPOS] = useState<string>('All');
  const [seasonalOnly, setSeasonalOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isTriageMode, setIsTriageMode] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSteps, setSyncSteps] = useState<string[]>([]);

  const towns = Array.from(new Set(clients.map(c => c.town).filter(Boolean))).sort() as string[];
  const categories = ['All', ...Array.from(new Set(clients.map(c => c.type).filter(Boolean)))];
  const posSystems = ['All', ...Array.from(new Set(clients.map(c => c.posSystem).filter(Boolean)))];

  const filteredData = clients.filter(c => {
    if (filterTown !== 'All' && c.town !== filterTown) return false;
    if (filterCategory !== 'All' && c.type !== filterCategory) return false;
    if (filterPOS !== 'All' && c.posSystem !== filterPOS) return false;
    if (seasonalOnly && c.seasonal) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = (c.name || c.company || '').toLowerCase();
      if (!name.includes(query)) return false;
    }
    return true;
  });

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingFacts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/intelligence/facts?status=pending');
      if (response.ok) {
        const data = await response.json();
        setPendingFacts(data.facts || []);
      }
    } catch (error) {
      console.error('Failed to load pending facts:', error);
    }
  }, []);

  useEffect(() => {
    loadClients();
    loadPendingFacts();
  }, [loadClients, loadPendingFacts]);

  const refreshMarketData = async () => {
    setIsSyncing(true);
    setSyncSteps([]);

    const steps = [
      "Connecting to Client Database...",
      "Scanning for New Intelligence...",
      "Cross-Referencing Business Data...",
      "Updating Client Profiles...",
      "Finalizing Intelligence Report..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setSyncSteps(prev => [...prev, steps[i]]);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      await Promise.all([loadClients(), loadPendingFacts()]);
      const now = new Date();
      setLastSynced(now);
      localStorage.setItem('intelligenceLastSynced', now.toISOString());
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      await new Promise(r => setTimeout(r, 500));
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const checkpoints = SYNC_TIMES.map(h => {
        const d = new Date();
        d.setHours(h, 0, 0, 0);
        return d;
      });

      const lastCheckpoint = checkpoints.filter(cp => cp < now).pop();

      if (lastCheckpoint) {
        if (!lastSynced || lastSynced < lastCheckpoint) {
          console.log("Auto-Sync Triggered");
          refreshMarketData();
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const handleProcessIngestion = async (rawText: string) => {
    try {
      const response = await fetch('/api/admin/intelligence/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, client_id: 'bulk' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.facts && data.facts.length > 0) {
          const newFacts: AtomicFact[] = data.facts.map((f: any, idx: number) => ({
            id: `fact-${Date.now()}-${idx}`,
            clientId: f.restaurantId || f.clientId || 'unknown',
            field: f.field,
            value: f.value,
            originalText: f.originalText || rawText.substring(0, 100),
            confidence: f.confidence || 0.7,
            status: 'pending' as FactStatus
          }));
          setPendingFacts(prev => [...prev, ...newFacts]);
          if (newFacts.length > 0) setIsTriageMode(true);
        }
      } else {
        const mockFact: AtomicFact = {
          id: `fact-${Date.now()}`,
          clientId: "demo-client",
          field: "posSystem",
          value: "Toast",
          originalText: rawText.substring(0, 50) + "...",
          confidence: 0.85,
          status: 'pending'
        };
        setPendingFacts(prev => [...prev, mockFact]);
        setIsTriageMode(true);
      }
    } catch (e) {
      console.error("AI Ingestion Failed", e);
    }
  };

  const handleReviewFact = async (factId: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setPendingFacts(prev => prev.filter(f => f.id !== factId));
      return;
    }

    const fact = pendingFacts.find(f => f.id === factId);
    if (!fact) return;

    setClients(prev => prev.map(client => {
      if (client.id === fact.clientId) {
        return { ...client, [fact.field]: fact.value };
      }
      return client;
    }));

    setPendingFacts(prev => prev.filter(f => f.id !== factId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SyncOverlay isVisible={isSyncing} steps={syncSteps} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-blue-700 rounded-full flex items-center justify-center text-white text-xl mr-3 shadow-md">C</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Client <span className="text-blue-600">Intelligence</span></h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Market Analytics Platform</p>
                {lastSynced && (
                  <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                    Synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={refreshMarketData} disabled={isSyncing} className="text-gray-400 hover:text-blue-700 transition-colors p-2">
              <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin text-blue-700' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>

            {pendingFacts.length > 0 && (
              <button onClick={() => setIsTriageMode(true)} className="relative bg-white text-orange-500 border border-orange-500 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-orange-50 transition-colors">
                Review Queue
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white">{pendingFacts.length}</span>
              </button>
            )}

            <button onClick={() => setIsIngestOpen(true)} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-600 transition-colors shadow-md flex items-center gap-2">
              <span>+</span> Import Intel
            </button>
          </div>
        </div>
      </header>

      {/* Triage Mode */}
      {isTriageMode && pendingFacts.length > 0 && (
        <div className="fixed inset-0 z-40 bg-gray-50/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <button onClick={() => setIsTriageMode(false)} className="absolute top-8 right-8 text-gray-400 hover:text-gray-900 font-bold uppercase text-xs tracking-widest">Close Triage</button>
          <div className="max-w-md w-full mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Intel Triage</h2>
            <p className="text-gray-500">Reviewing {pendingFacts.length} incoming data points.</p>
          </div>
          <FactReviewCard
            fact={pendingFacts[0]}
            clientName={clients.find(c => c.id === pendingFacts[0].clientId)?.name}
            onConfirm={() => handleReviewFact(pendingFacts[0].id, 'approve')}
            onDiscard={() => handleReviewFact(pendingFacts[0].id, 'reject')}
          />
        </div>
      )}

      {/* Hero */}
      <div className="bg-gray-100 py-8 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl text-gray-900 mb-4 leading-tight font-bold">Market Intelligence & Client Directory</h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Access POS data, licensure status, and business analysis for {clients.length}+ clients.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Analytics */}
        <section id="analytics" className="mb-12">
          <div className="mb-6">
            <h3 className="text-2xl text-gray-900 mb-2 border-l-4 border-orange-500 pl-4 font-bold">Market Analytics</h3>
            <p className="text-gray-600">Real-time visualizations of the current dataset.</p>
          </div>
          <DashboardCharts data={clients} />
        </section>

        {/* Directory */}
        <section id="directory">
          <div className="mb-6">
            <h3 className="text-2xl text-gray-900 mb-2 border-l-4 border-blue-500 pl-4 font-bold">The Directory</h3>
            <p className="text-gray-600">Click any card for the <strong className="text-blue-700">Consultant Dossier</strong>.</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 sticky top-20 z-30">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div className="w-full lg:w-64">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search</label>
                <input type="text" placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="w-full lg:w-48">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm" value={filterTown} onChange={(e) => setFilterTown(e.target.value)}>
                  <option value="All">All Locations</option>
                  {towns.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="w-full lg:w-48">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">POS System</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm" value={filterPOS} onChange={(e) => setFilterPOS(e.target.value)}>
                  {posSystems.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-x-auto pb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                <div className="flex space-x-2">
                  {categories.slice(0, 6).map(c => (
                    <button key={c} onClick={() => setFilterCategory(c)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${filterCategory === c ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-500'}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-bold text-blue-700">{filteredData.length} Clients Found</span>
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <span className="text-sm text-gray-600">Year-Round Only</span>
                <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${seasonalOnly ? 'bg-blue-700' : 'bg-gray-300'}`}>
                  <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${seasonalOnly ? 'translate-x-5' : ''}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={seasonalOnly} onChange={(e) => setSeasonalOnly(e.target.checked)} />
              </label>
            </div>
          </div>

          {/* Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map(client => (
              <div key={client.id} onClick={() => setSelectedClient(client)} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all hover:-translate-y-1 cursor-pointer flex flex-col h-full group relative overflow-hidden">
                <div className={`h-1 w-full ${client.seasonal ? 'bg-orange-500' : 'bg-green-600'}`}></div>
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-gray-100 text-gray-600 text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-sm">{client.town || client.region || 'Unknown'}</span>
                    {client.rating && (
                      <div className="flex items-center space-x-1 text-orange-500">
                        <span className="text-sm font-bold">{client.rating}</span>
                        <span className="text-xs">★</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">{client.company || client.name}</h3>
                  <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-wider">{client.type || 'Business'} {client.price ? `• ${'$'.repeat(client.price)}` : ''}</p>
                  {client.desc && (<p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{client.desc}</p>)}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {client.posSystem && client.posSystem !== 'Unknown' && (<span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded font-bold">{client.posSystem}</span>)}
                    {client.seatingCapacity && (<span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded font-bold">{client.seatingCapacity} seats</span>)}
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center text-xs">
                  <span className={`font-bold uppercase tracking-wider ${client.seasonal ? 'text-orange-500' : 'text-green-700'}`}>{client.seasonal ? 'Seasonal' : 'Year-Round'}</span>
                  <span className="text-blue-700 font-bold group-hover:translate-x-1 transition-transform">View Dossier →</span>
                </div>
              </div>
            ))}
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No clients match your current filters.</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-xl mb-3 font-bold">Client Intelligence Platform</h2>
          <p className="text-sm text-gray-400 mb-6">Market Intelligence powered by AI analysis.</p>
          <div className="border-t border-gray-700 pt-6 text-xs text-gray-500">&copy; {new Date().getFullYear()} R&G Consulting LLC. All rights reserved.</div>
        </div>
      </footer>

      {selectedClient && (
        <ClientDossierModal client={selectedClient} onClose={() => setSelectedClient(null)} pendingFacts={pendingFacts} onReviewFact={handleReviewFact} />
      )}

      {isIngestOpen && (
        <IngestionModal onClose={() => setIsIngestOpen(false)} onProcess={handleProcessIngestion} />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default ClientIntelligenceTab;
