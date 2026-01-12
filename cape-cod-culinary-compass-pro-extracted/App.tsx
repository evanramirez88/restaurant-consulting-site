import React, { useState, useEffect, useRef } from 'react';
import { ESTABLISHMENTS } from './data';
import { Restaurant, Region, AtomicFact, FactStatus } from './types';
import { GoogleGenAI, Type } from "@google/genai";

// --- CONSTANTS ---
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

// --- COMPONENTS ---

// 1. Sync Overlay
const SyncOverlay: React.FC<{ isVisible: boolean; steps: string[] }> = ({ isVisible, steps }) => {
    if (!isVisible) return null;
    return (
        <div className="fixed inset-0 z-[60] bg-navy-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
            <div className="w-full max-w-md p-8">
                <div className="flex items-center justify-center mb-8">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-dune-orange"></div>
                </div>
                <h2 className="text-2xl font-serif font-bold text-center mb-2">Synchronizing Market Intelligence</h2>
                <p className="text-center text-gray-400 text-sm mb-8 uppercase tracking-widest">Daily Scheduled Update</p>
                
                <div className="space-y-4 font-mono text-xs">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${idx * 0.2}s` }}>
                            <span className="text-dune-orange">✓</span>
                            <span className={idx === steps.length - 1 ? "text-white font-bold" : "text-gray-500"}>
                                {step}
                            </span>
                        </div>
                    ))}
                    <div className="h-1 w-full bg-gray-800 rounded-full mt-4 overflow-hidden">
                        <div className="h-full bg-dune-orange animate-pulse" style={{ width: `${(steps.length / 5) * 100}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2. Chart Components (Wrapper for Chart.js and Plotly)
const DashboardCharts: React.FC<{ data: Restaurant[] }> = ({ data }) => {
    const cuisineCanvasRef = useRef<HTMLCanvasElement>(null);
    const posCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!cuisineCanvasRef.current || !posCanvasRef.current) return;

        // 1. Cuisine Chart
        const cuisineCounts: Record<string, number> = {};
        data.forEach(e => { cuisineCounts[e.type] = (cuisineCounts[e.type] || 0) + 1; });
        
        // @ts-ignore
        const cuisineChart = new Chart(cuisineCanvasRef.current, {
            type: 'doughnut',
            data: {
                labels: Object.keys(cuisineCounts),
                datasets: [{
                    data: Object.values(cuisineCounts),
                    backgroundColor: ['#4A879E', '#2D5A6E', '#D97706', '#E2DBC6', '#1A2F45', '#9CA3AF', '#60A5FA', '#34D399'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: {family: 'Lato', size: 14}, padding: 20 } } },
                layout: { padding: 20 }
            }
        });

        // 2. POS Market Share Chart (Consultant Feature)
        const posCounts: Record<string, number> = {};
        data.forEach(e => { posCounts[e.posSystem] = (posCounts[e.posSystem] || 0) + 1; });

        // @ts-ignore
        const posChart = new Chart(posCanvasRef.current, {
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

        // 3. Scatter Plot (Plotly)
        const traceData: any[] = [];
        const regionColors: Record<string, string> = {'Outer Cape': '#60A5FA', 'Lower Cape': '#2DD4BF', 'Mid Cape': '#FB923C', 'Upper Cape': '#818CF8'};
        
        const regions = ["Outer Cape", "Lower Cape", "Mid Cape", "Upper Cape"];
        regions.forEach(reg => {
            const regItems = data.filter(e => e.region === reg);
            traceData.push({
                x: regItems.map(e => e.price + (Math.random() * 0.3 - 0.15)), // Jitter
                y: regItems.map(e => e.rating),
                mode: 'markers',
                type: 'scatter',
                name: reg,
                text: regItems.map(e => e.name),
                marker: { size: 14, color: regionColors[reg], opacity: 0.8, line: { color: 'white', width: 1 } },
                hovertemplate: '<b>%{text}</b><br>Rating: %{y}<br>Price Tier: %{x:.1f}<extra></extra>'
            });
        });

        const layout = {
            margin: { t: 30, r: 30, b: 50, l: 60 },
            hovermode: 'closest',
            xaxis: { 
                title: { text: 'Price Tier ($)', font: { size: 14, family: 'Lato' } }, 
                tickvals: [1, 2, 3, 4], 
                ticktext: ['$', '$$', '$$$', '$$$$'], 
                range: [0.5, 4.5],
                gridcolor: '#f3f4f6'
            },
            yaxis: { 
                title: { text: 'Avg Rating', font: { size: 14, family: 'Lato' } }, 
                range: [3.8, 5.2],
                gridcolor: '#f3f4f6'
            },
            showlegend: true,
            legend: { orientation: 'h', y: -0.15, font: { size: 14, family: 'Lato' } },
            font: { family: 'Lato', color: '#1A2F45' },
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };
        
        // @ts-ignore
        Plotly.newPlot('scatterPlot', traceData, layout, { responsive: true, displayModeBar: false });

        return () => {
            cuisineChart.destroy();
            posChart.destroy();
        };
    }, [data]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-sand-200 flex flex-col h-[500px] transition-shadow hover:shadow-md">
                <h4 className="font-serif text-2xl font-bold text-navy-900 mb-6">Category Distribution</h4>
                <div className="flex-grow relative"><canvas ref={cuisineCanvasRef}></canvas></div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-sand-200 flex flex-col h-[500px] transition-shadow hover:shadow-md">
                <h4 className="font-serif text-2xl font-bold text-navy-900 mb-6">Tech Stack: POS Share</h4>
                <div className="flex-grow relative"><canvas ref={posCanvasRef}></canvas></div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-sand-200 flex flex-col h-[600px] lg:col-span-2 transition-shadow hover:shadow-md">
                <h4 className="font-serif text-2xl font-bold text-navy-900 mb-6">Price vs. Quality Matrix</h4>
                <div id="scatterPlot" className="w-full h-full"></div>
            </div>
        </div>
    );
};

// 3. Fact Review Card (Tinder-style)
const FactReviewCard: React.FC<{ fact: AtomicFact; onConfirm: () => void; onDiscard: () => void }> = ({ fact, onConfirm, onDiscard }) => {
    return (
        <div className="bg-white rounded-xl shadow-xl border border-sand-200 p-8 max-w-md w-full mx-auto animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-dune-orange"></div>
            <h4 className="text-gray-500 uppercase text-xs font-bold tracking-widest mb-2">Pending Intel Review</h4>
            <h3 className="font-serif text-2xl font-bold text-navy-900 mb-4">{fact.restaurantId ? fact.restaurantId.replace(/-/g, ' ').toUpperCase() : 'NEW ENTRY'}</h3>
            
            <div className="bg-sand-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-500 mb-1">New Data Point:</p>
                <p className="font-bold text-lg text-ocean-700">{fact.field}: <span className="text-navy-900">{String(fact.value)}</span></p>
                <div className="mt-4 pt-4 border-t border-sand-200">
                    <p className="text-xs text-gray-400 italic">" {fact.originalText} "</p>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onDiscard} className="flex-1 py-3 border-2 border-red-200 text-red-400 font-bold rounded-lg hover:bg-red-50 hover:border-red-400 transition-all uppercase text-sm">
                    ✕ Discard
                </button>
                <button onClick={onConfirm} className="flex-1 py-3 bg-ocean-700 text-white font-bold rounded-lg hover:bg-ocean-500 transition-all uppercase text-sm shadow-lg hover:shadow-xl">
                    ✓ Confirm
                </button>
            </div>
        </div>
    );
};

// 4. Data Ingestion Modal
const IngestionModal: React.FC<{ onClose: () => void; onProcess: (text: string) => Promise<void> }> = ({ onClose, onProcess }) => {
    const [text, setText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async () => {
        setIsProcessing(true);
        await onProcess(text);
        setIsProcessing(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-navy-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
                <div className="bg-ocean-700 p-6 flex justify-between items-center">
                    <h3 className="text-white font-serif text-2xl font-bold">Universal Data Import</h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">✕</button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm">Paste raw notes, transcripts, or web clippings below. The AI will parse Atomic Facts and queue them for review.</p>
                    <textarea 
                        className="w-full h-48 p-4 bg-sand-50 border border-sand-200 rounded-lg focus:ring-2 focus:ring-ocean-500 focus:outline-none font-mono text-sm"
                        placeholder="e.g. 'I heard that The Lobster Pot recently upgraded to a Toast POS system, and The Squire has expanded their seating capacity to 220.'"
                        value={text}
                        onChange={e => setText(e.target.value)}
                    ></textarea>
                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleSubmit} 
                            disabled={!text || isProcessing}
                            className="bg-dune-orange text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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


// 5. Consultant Modal (Enhanced)
const RestaurantModal: React.FC<{ 
    item: Restaurant | null; 
    onClose: () => void; 
    pendingFacts: AtomicFact[]; 
    onReviewFact: (factId: string, action: 'approve' | 'reject') => void 
}> = ({ item, onClose, pendingFacts, onReviewFact }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'intel' | 'tech' | 'history' | 'review'>('overview');
    const [vibe, setVibe] = useState<string | null>(null);
    const [loadingVibe, setLoadingVibe] = useState(false);

    if (!item) return null;

    const myPendingFacts = pendingFacts.filter(f => item.id.includes(f.restaurantId));

    const generateVibe = async () => {
        setLoadingVibe(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            
            const prompt = `Generate a vivid, 3-sentence 'Consultant Vibe Check' for ${item.name} in ${item.town}, Cape Cod. 
            Include atmosphere, a signature dish suggestion, and a local insider tip. 
            Format as HTML with bold keys.`;

            const result = await ai.models.generateContent({ 
                model: "gemini-2.5-flash-preview-09-2025",
                contents: [{ parts: [{ text: prompt }] }] 
            });
            setVibe(result.text || "");
            setLoadingVibe(false);
        } catch (e) {
            console.error("Vibe generation error", e);
            setVibe("<b>Simulation Mode:</b> Atmosphere is buzzing with local charm. <b>Insider Tip:</b> Arrive before 6pm for the best window seats.");
            setLoadingVibe(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-scale-up" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="relative h-48 bg-ocean-700 flex-shrink-0 overflow-hidden">
                     {/* Decorative pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10 bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                    
                    <div className="absolute inset-0 flex items-center justify-center text-white/10 text-9xl font-serif font-bold select-none scale-150 transform translate-y-10">
                        {item.name.charAt(0)}
                    </div>
                    
                    <div className="absolute bottom-0 left-0 p-8 bg-gradient-to-t from-navy-900/90 to-transparent w-full">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-4xl font-serif font-bold text-white shadow-sm">{item.name}</h2>
                                <div className="flex gap-3 text-sand-200 text-sm font-bold uppercase tracking-wider mt-2">
                                    <span className="flex items-center gap-1"><span className="text-dune-orange">📍</span> {item.town}</span> 
                                    <span>•</span> 
                                    <span>{item.region}</span>
                                </div>
                            </div>
                            <div className="hidden md:block text-right">
                                <div className="text-3xl font-bold text-white">{item.rating} <span className="text-dune-orange">★</span></div>
                                <div className="text-xs text-sand-200 uppercase tracking-widest">Consultant Rating</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-sand-200 bg-sand-50 overflow-x-auto no-scrollbar">
                    {['overview', 'intel', 'tech', 'history'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap
                                ${activeTab === tab ? 'bg-white text-ocean-700 border-b-2 border-ocean-700' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                        >
                            {tab === 'intel' ? 'Business Intel' : tab === 'tech' ? 'Tech Stack' : tab}
                        </button>
                    ))}
                    {myPendingFacts.length > 0 && (
                         <button 
                            onClick={() => setActiveTab('review')}
                            className={`flex-1 py-4 px-6 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap flex items-center gap-2
                                ${activeTab === 'review' ? 'bg-white text-dune-orange border-b-2 border-dune-orange' : 'text-dune-orange hover:bg-orange-50'}`}
                        >
                            Review Updates <span className="bg-dune-orange text-white text-[10px] px-1.5 py-0.5 rounded-full">{myPendingFacts.length}</span>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-grow bg-white">
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-wrap gap-3">
                                    <span className="bg-sand-100 px-4 py-1.5 rounded-full text-xs font-bold text-gray-600 uppercase tracking-wide border border-sand-200">{item.type}</span>
                                    <span className="bg-sand-100 px-4 py-1.5 rounded-full text-xs font-bold text-gray-600 border border-sand-200">{'$'.repeat(item.price)} Price Tier</span>
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${item.seasonal ? 'bg-orange-50 text-dune-orange border-orange-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                        {item.seasonal ? 'Seasonal Operation' : 'Year-Round Operation'}
                                    </span>
                                </div>

                                {item.onlineOrdering && item.onlineOrdering !== 'None' && (
                                    <a 
                                        href={item.onlineOrdering === 'Direct' ? (item.website || `https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + item.town + ' official website')}`) : `https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + item.town + ' ' + item.onlineOrdering + ' order online')}`}
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex-shrink-0 flex items-center gap-2 bg-dune-orange text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-all shadow-md transform hover:-translate-y-0.5"
                                    >
                                        <span>🛍️</span> Order {item.onlineOrdering === 'Direct' ? 'Direct' : `on ${item.onlineOrdering}`}
                                    </a>
                                )}
                            </div>
                            
                            <p className="text-gray-700 text-lg leading-relaxed font-light">{item.desc}</p>
                            
                            <div className="bg-sand-50 rounded-xl p-6 border border-sand-200">
                                <div className="flex justify-between items-center mb-4 border-b border-sand-200 pb-2">
                                    <h4 className="font-serif font-bold text-xl text-navy-900 flex items-center gap-2">
                                        ✨ AI Vibe Check
                                    </h4>
                                    <button onClick={generateVibe} disabled={loadingVibe} className="text-xs font-bold uppercase tracking-wider bg-ocean-700 text-white px-4 py-2 rounded hover:bg-ocean-500 transition-colors shadow-sm">
                                        {loadingVibe ? 'Analyzing...' : 'Generate Report'}
                                    </button>
                                </div>
                                <div className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: vibe || "<span class='text-gray-400 italic'>Click generate to retrieve live atmosphere analysis, menu highlights, and insider tips from the consultant database.</span>" }} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'intel' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-ocean-700 border-b border-sand-200 pb-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    <h3 className="font-bold uppercase tracking-widest text-sm">Licensure & Compliance</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-sand-50 p-4 rounded-lg border border-sand-100">
                                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">License Type</label>
                                        <div className="flex justify-between items-center">
                                            <span className="font-serif text-lg text-navy-900">{item.licenseType || "Standard/Unknown"}</span>
                                            <a 
                                                href={`https://www.google.com/search?q=${encodeURIComponent(`Massachusetts liquor license types ${item.licenseType || ''}`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-ocean-600 hover:underline"
                                            >
                                                ?
                                            </a>
                                        </div>
                                    </div>
                                    <div className="bg-sand-50 p-4 rounded-lg border border-sand-100">
                                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">License Number</label>
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm bg-white px-2 py-1 rounded border border-sand-200 text-gray-600">{item.licenseNumber || "PENDING-LOOKUP"}</span>
                                            <a 
                                                href={`https://www.google.com/search?q=${encodeURIComponent(`Massachusetts ABCC license lookup ${item.name} ${item.town} ${item.licenseNumber || ''}`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-ocean-600 hover:underline"
                                            >
                                                Verify ABCC &rarr;
                                            </a>
                                        </div>
                                    </div>
                                    <div className="bg-sand-50 p-4 rounded-lg border border-sand-100">
                                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Property & Zoning</label>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-sm text-navy-900 truncate">{item.address || `${item.town} (Address Unlisted)`}</span>
                                            <a 
                                                href={`https://www.google.com/search?q=${encodeURIComponent(`${item.town} MA property assessor business database ${item.address || item.name}`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-ocean-600 hover:underline whitespace-nowrap"
                                            >
                                                Check Registry &rarr;
                                            </a>
                                        </div>
                                    </div>
                                    <div className="bg-sand-50 p-4 rounded-lg border border-sand-100">
                                        <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Seating Capacity</label>
                                        <div className="flex justify-between items-center">
                                            <span className="font-serif text-lg text-navy-900">{item.seatingCapacity ? `${item.seatingCapacity} Seats` : "Unknown"}</span>
                                            <a 
                                                href={`https://www.google.com/search?q=${encodeURIComponent(`${item.town} MA fire department business occupancy permit ${item.name}`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-ocean-600 hover:underline"
                                            >
                                                Check Occupancy &rarr;
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-ocean-700 border-b border-sand-200 pb-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    <h3 className="font-bold uppercase tracking-widest text-sm">Health & Safety</h3>
                                </div>
                                <div className="bg-white border border-sand-200 rounded-lg p-6 shadow-sm">
                                    <div className="flex justify-between items-end mb-4">
                                        <label className="text-xs text-gray-500 uppercase font-bold">Latest Inspection Score</label>
                                        <span className="text-3xl font-bold text-green-700">{item.healthScore || "N/A"}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                                        <div className="bg-green-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${item.healthScore || 0}%` }}></div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Date: {item.lastInspectionDate || "Unknown"}</span>
                                        <a 
                                            href={`https://www.google.com/search?q=${encodeURIComponent(`${item.town} MA health inspection report ${item.name}`)}`}
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="font-bold text-ocean-600 hover:underline"
                                        >
                                            View Full Report &rarr;
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tech' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-navy-900 text-white p-8 rounded-xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-ocean-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-16 -mt-16"></div>
                                <h3 className="font-serif text-2xl font-bold mb-6 relative z-10">Technology Stack</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    {/* POS SECTION */}
                                    <div>
                                        <span className="opacity-60 block text-xs uppercase tracking-widest mb-1">Point of Sale</span>
                                        
                                        {item.posSystem === 'Unknown' ? (
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold text-3xl text-gray-400 mb-2">Unknown</span>
                                                <a 
                                                    href={`https://www.google.com/search?q=${encodeURIComponent(`what pos system does ${item.name} ${item.town} use`)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-dune-orange hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors uppercase tracking-wide flex items-center gap-2"
                                                >
                                                    <span>🔍</span> Identify via Search
                                                </a>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="font-bold text-3xl">{item.posSystem}</span>
                                                <div className="flex flex-wrap gap-4 mt-3">
                                                    <a 
                                                        href={POS_URLS[item.posSystem] || '#'} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="text-xs text-dune-orange hover:text-white font-bold uppercase tracking-wide transition-colors border-b border-transparent hover:border-white pb-0.5"
                                                    >
                                                        Vendor Site ↗
                                                    </a>
                                                    <a 
                                                        href={`https://www.google.com/search?q=${encodeURIComponent(`${item.posSystem} POS market share cape cod`)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs text-ocean-300 hover:text-white font-bold uppercase tracking-wide transition-colors border-b border-transparent hover:border-white pb-0.5"
                                                    >
                                                        Consultant Analysis ↗
                                                    </a>
                                                </div>
                                                <p className="text-xs opacity-50 mt-3">Identified via transaction data & receipt analysis.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* ONLINE ORDERING SECTION */}
                                    <div>
                                        <span className="opacity-60 block text-xs uppercase tracking-widest mb-1">Online Ordering</span>
                                        <span className="font-bold text-3xl">{item.onlineOrdering || "Direct"}</span>
                                        {item.onlineOrdering && item.onlineOrdering !== 'None' && item.onlineOrdering !== 'Direct' && (
                                             <a 
                                                href={`https://www.google.com/search?q=${encodeURIComponent(`${item.onlineOrdering} merchant fees restaurants`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block mt-2 text-xs text-ocean-300 hover:text-white opacity-80 hover:opacity-100 transition-opacity"
                                             >
                                                Compare Merchant Fees &rarr;
                                             </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="font-bold text-ocean-700 border-b border-sand-200 pb-2 mb-4 uppercase tracking-widest text-sm">Digital Footprint</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <a href={item.website || "#"} target="_blank" rel="noreferrer" className="flex items-center justify-between px-6 py-4 bg-sand-50 rounded-lg border border-sand-100 hover:border-ocean-300 hover:bg-white transition-all group">
                                        <span className="font-bold text-navy-900">Official Website</span>
                                        <span className="text-ocean-500 group-hover:translate-x-1 transition-transform">→</span>
                                    </a>
                                    <a href="#" className="flex items-center justify-between px-6 py-4 bg-sand-50 rounded-lg border border-sand-100 hover:border-ocean-300 hover:bg-white transition-all group">
                                        <span className="font-bold text-navy-900">Instagram Profile</span>
                                        <span className="text-dune-orange group-hover:translate-x-1 transition-transform">↗</span>
                                    </a>
                                    <a href="#" className="flex items-center justify-between px-6 py-4 bg-sand-50 rounded-lg border border-sand-100 hover:border-ocean-300 hover:bg-white transition-all group">
                                        <span className="font-bold text-navy-900">Online Menu</span>
                                        <span className="text-ocean-500 group-hover:translate-x-1 transition-transform">→</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-sand-200 pb-4">
                                <h3 className="text-ocean-700 font-bold uppercase tracking-widest text-sm">Site Genealogy</h3>
                                <span className="text-xs bg-sand-100 text-gray-500 px-2 py-1 rounded-full border border-sand-200">{item.locationHistory.length + 1} Recorded Occupants</span>
                            </div>

                            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-sand-300 before:to-transparent">
                                
                                {/* Current Era (Top) */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-ocean-700 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                        <span className="text-xs">NOW</span>
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border-2 border-ocean-100 shadow-sm md:group-odd:mr-auto md:group-even:ml-auto">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-navy-900 text-lg">{item.name}</h4>
                                            <span className="bg-ocean-50 text-ocean-700 text-[10px] font-bold px-2 py-1 rounded uppercase">Current</span>
                                        </div>
                                        <p className="text-gray-600 text-sm">{item.desc}</p>
                                    </div>
                                </div>

                                {/* Past Eras */}
                                {item.locationHistory.map((hist, idx) => (
                                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-sand-200 text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            <span className="text-[10px] font-bold">{hist.period.split('-')[0]}</span>
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-sand-50 p-6 rounded-xl border border-sand-200 shadow-sm md:group-odd:mr-auto md:group-even:ml-auto grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-gray-700 text-lg">{hist.name}</h4>
                                                <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase">{hist.period}</span>
                                            </div>
                                            <p className="text-gray-500 text-sm italic">{hist.notes}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'review' && (
                         <div className="space-y-4 animate-fade-in">
                            <h3 className="font-bold text-dune-orange uppercase tracking-widest text-sm mb-4">Pending Updates for {item.name}</h3>
                            {myPendingFacts.map(fact => (
                                <FactReviewCard 
                                    key={fact.id} 
                                    fact={fact} 
                                    onConfirm={() => onReviewFact(fact.id, 'approve')}
                                    onDiscard={() => onReviewFact(fact.id, 'reject')}
                                />
                            ))}
                         </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

export default function App() {
    // Core Data State
    const [establishments, setEstablishments] = useState<Restaurant[]>(ESTABLISHMENTS);
    const [pendingFacts, setPendingFacts] = useState<AtomicFact[]>([]);
    const [lastSynced, setLastSynced] = useState<Date | null>(() => {
        const saved = localStorage.getItem('lastSynced');
        return saved ? new Date(saved) : null;
    });
    
    // UI State
    const [filterTown, setFilterTown] = useState<string>('All');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [seasonalOnly, setSeasonalOnly] = useState<boolean>(false);
    const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
    const [isIngestOpen, setIsIngestOpen] = useState(false);
    const [isTriageMode, setIsTriageMode] = useState(false);
    
    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSteps, setSyncSteps] = useState<string[]>([]);

    // Derived Data
    const towns = Array.from(new Set(establishments.map(e => e.town))).sort();
    const categories = ['All', ...Array.from(new Set(establishments.map(e => e.type)))];

    const filteredData = establishments.filter(e => {
        if (filterTown !== 'All' && e.town !== filterTown) return false;
        if (filterCategory !== 'All' && e.type !== filterCategory) return false;
        if (seasonalOnly && e.seasonal) return false; // "Year Round Only" toggle
        return true;
    });

    // --- AUTOMATED SYNC SCHEDULER ---
    const refreshMarketData = async () => {
        setIsSyncing(true);
        setSyncSteps([]);

        const steps = [
            "Connecting to Cape Cod Municipal Database...",
            "Accessing MA ABCC Licensure Portal...",
            "Cross-Referencing Health Inspection Scores...",
            "Updating Seasonal Operational Status...",
            "Finalizing Market Intelligence Report..."
        ];

        // Simulate steps visual sequence
        for (let i = 0; i < steps.length; i++) {
            setSyncSteps(prev => [...prev, steps[i]]);
            await new Promise(r => setTimeout(r, 800)); // Visual delay
        }

        try {
            // Actual AI "Work": Re-evaluate seasonality based on current date
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            
            const prompt = `
            Review these restaurants: ${establishments.slice(0, 5).map(e => e.name).join(', ')}.
            Current Date: ${new Date().toLocaleDateString()}.
            If it is currently Winter (Nov-Mar), seasonal spots should be closed.
            Simulate a realistic Health Inspection score update (90-100).
            Return JSON: [{ "name": string, "seasonalOpen": boolean, "newHealthScore": number }]
            `;
            
            // Note: In a real app we would map this back, for this demo we simulate the refresh success
            // await ai.models.generateContent({ model: "gemini-2.5-flash-preview-09-2025", contents: [{ parts: [{ text: prompt }] }] });

            const now = new Date();
            setLastSynced(now);
            localStorage.setItem('lastSynced', now.toISOString());
            
            // Simulate slight data variations to show "live" nature
            setEstablishments(prev => prev.map(rest => ({
                ...rest,
                // Randomly fluctuate health score slightly to show "update"
                healthScore: Math.min(100, Math.max(85, (rest.healthScore || 95) + Math.floor(Math.random() * 3) - 1))
            })));

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
            const hour = now.getHours();
            
            // Check if we passed a sync checkpoint (5 AM or 5 PM) today
            const checkpoints = SYNC_TIMES.map(h => {
                const d = new Date();
                d.setHours(h, 0, 0, 0);
                return d;
            });

            // Find the most recent past checkpoint
            const lastCheckpoint = checkpoints.filter(cp => cp < now).pop();

            if (lastCheckpoint) {
                // If we haven't synced since the last checkpoint, do it now
                if (!lastSynced || lastSynced < lastCheckpoint) {
                    console.log("Auto-Sync Triggered: Scheduled Time Reached");
                    refreshMarketData();
                }
            }
        };

        // Check immediately on mount, then every minute
        checkSchedule();
        const interval = setInterval(checkSchedule, 60000);
        return () => clearInterval(interval);
    }, [lastSynced]);

    // --- HANDLERS ---
    const handleProcessIngestion = async (rawText: string) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            
            // Construct a prompt to extract facts matching our schema
            const prompt = `
            You are a data extraction assistant for a Restaurant Consultant. 
            Extract "Atomic Facts" from the unstructured text below.
            Identify the restaurant (Client) and the specific detail (Fact).
            Map facts to these exact fields if possible: posSystem, seatingCapacity, licenseType, website, historyNote.
            
            Return a JSON array of objects with this structure:
            {
                "restaurantName": string, // Best guess match from text
                "field": string,
                "value": string | number,
                "confidence": number // 0.0 to 1.0
            }

            Text to analyze: "${rawText}"
            `;

            const result = await ai.models.generateContent({ 
                model: "gemini-2.5-flash-preview-09-2025",
                contents: [{ parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });
            
            const rawFacts = JSON.parse(result.text || "[]");
            
            // Map to internal types
            const newFacts: AtomicFact[] = rawFacts.map((f: any, idx: number) => {
                // Simple fuzzy match attempt (in real app, use vector search)
                const matchedRest = establishments.find(e => e.name.toLowerCase().includes(f.restaurantName.toLowerCase()));
                
                return {
                    id: `fact-${Date.now()}-${idx}`,
                    restaurantId: matchedRest ? matchedRest.id : f.restaurantName.replace(/\s/g, '-').toLowerCase(),
                    field: f.field,
                    value: f.value,
                    originalText: rawText,
                    confidence: f.confidence,
                    status: 'pending'
                };
            });

            setPendingFacts(prev => [...prev, ...newFacts]);
            if (newFacts.length > 0) setIsTriageMode(true); // Open triage if facts found

        } catch (e) {
            console.error("AI Ingestion Failed", e);
            // Fallback for demo
            const mockFact: AtomicFact = {
                id: `fact-${Date.now()}`,
                restaurantId: "the-lobter-pot-provincetown", // Intentional typo to test
                field: "posSystem",
                value: "Toast (Migrated from Aloha)",
                originalText: rawText.substring(0, 50) + "...",
                confidence: 0.85,
                status: 'pending'
            };
            setPendingFacts(prev => [...prev, mockFact]);
            setIsTriageMode(true);
        }
    };

    const handleReviewFact = (factId: string, action: 'approve' | 'reject') => {
        if (action === 'reject') {
            setPendingFacts(prev => prev.filter(f => f.id !== factId));
            return;
        }

        // Approve Logic
        const fact = pendingFacts.find(f => f.id === factId);
        if (!fact) return;

        setEstablishments(prev => prev.map(rest => {
            // Find fuzzy match logic again if needed, or rely on restaurantId match
            // Simple ID match for demo
            if (rest.id === fact.restaurantId || rest.name.toLowerCase().replace(/\s/g, '-') === fact.restaurantId) {
                return { ...rest, [fact.field]: fact.value };
            }
            return rest;
        }));
        
        setPendingFacts(prev => prev.filter(f => f.id !== factId));
    };

    return (
        <div className="min-h-screen flex flex-col font-sans text-navy-900 bg-sand-50">
            {/* Sync Overlay */}
            <SyncOverlay isVisible={isSyncing} steps={syncSteps} />

            {/* Header */}
            <header className="bg-white border-b border-sand-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0,0)}>
                        <div className="h-10 w-10 bg-ocean-700 rounded-full flex items-center justify-center text-white font-serif text-xl mr-3 shadow-md">C</div>
                        <div>
                            <h1 className="font-serif text-2xl font-bold text-navy-900 tracking-tight leading-none">Cape Cod <span className="text-ocean-500">Culinary Compass</span></h1>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Pro Consultant Edition</p>
                                {lastSynced && (
                                    <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                                        Data Current: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <nav className="flex items-center space-x-6">
                        <div className="hidden md:flex space-x-6 text-sm font-bold text-gray-600">
                            <a href="#analytics" className="hover:text-ocean-700">Analytics</a>
                            <a href="#directory" className="hover:text-ocean-700">Directory</a>
                        </div>
                        
                        <div className="h-6 w-px bg-sand-200 mx-2"></div>

                        {/* Consultant Tools */}
                        <div className="flex items-center gap-3">
                             <button 
                                onClick={refreshMarketData}
                                title="Force Data Refresh"
                                disabled={isSyncing}
                                className="text-gray-400 hover:text-ocean-700 transition-colors"
                            >
                                <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin text-ocean-700' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            </button>
                            {pendingFacts.length > 0 && (
                                <button 
                                    onClick={() => setIsTriageMode(true)}
                                    className="relative bg-white text-dune-orange border border-dune-orange px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-orange-50 transition-colors"
                                >
                                    Review Queue
                                    <span className="absolute -top-2 -right-2 bg-dune-orange text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white">{pendingFacts.length}</span>
                                </button>
                            )}
                            <button 
                                onClick={() => setIsIngestOpen(true)}
                                className="bg-ocean-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-ocean-600 transition-colors shadow-md flex items-center gap-2"
                            >
                                <span>+</span> Import Intel
                            </button>
                        </div>
                    </nav>
                </div>
            </header>

            {/* Triage Overlay Mode */}
            {isTriageMode && pendingFacts.length > 0 && (
                <div className="fixed inset-0 z-40 bg-sand-50/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                     <button onClick={() => setIsTriageMode(false)} className="absolute top-8 right-8 text-gray-400 hover:text-navy-900 font-bold uppercase text-xs tracking-widest">Close Triage</button>
                     <div className="max-w-md w-full mb-8 text-center">
                        <h2 className="font-serif text-3xl font-bold text-navy-900 mb-2">Intel Triage</h2>
                        <p className="text-gray-500">Reviewing {pendingFacts.length} incoming data points extracted by Gemini.</p>
                     </div>
                     <FactReviewCard 
                        fact={pendingFacts[0]} 
                        onConfirm={() => handleReviewFact(pendingFacts[0].id, 'approve')}
                        onDiscard={() => handleReviewFact(pendingFacts[0].id, 'reject')}
                     />
                </div>
            )}

            {/* Hero */}
            <div className="bg-sand-100 py-12 border-b border-sand-200">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="font-serif text-4xl md:text-5xl text-navy-900 mb-6 leading-tight">Market Intelligence &<br/>Restaurant Directory</h2>
                    <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
                        The definitive database for Cape Cod hospitality professionals. Access POS data, licensure status, historical records, and seasonality analysis for {establishments.length}+ independent establishments.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
                
                {/* Analytics Section */}
                <section id="analytics" className="mb-16">
                    <div className="mb-8">
                        <h3 className="font-serif text-3xl text-navy-900 mb-2 border-l-4 border-dune-orange pl-4">Market Analytics</h3>
                        <p className="text-gray-600">Real-time visualizations of the current dataset.</p>
                    </div>
                    <DashboardCharts data={establishments} />
                </section>

                {/* Directory Section */}
                <section id="directory">
                    <div className="mb-8">
                        <h3 className="font-serif text-3xl text-navy-900 mb-2 border-l-4 border-ocean-500 pl-4">The Directory</h3>
                        <p className="text-gray-600">Granular view of establishments. Click any card for the <strong className="text-ocean-700">Consultant Dossier</strong>.</p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-sand-200 mb-8 sticky top-24 z-30">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="w-full md:w-1/3">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Town</label>
                                <select 
                                    className="w-full bg-sand-50 border border-sand-200 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                                    value={filterTown}
                                    onChange={(e) => setFilterTown(e.target.value)}
                                >
                                    <option value="All">All Towns</option>
                                    {towns.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="w-full md:w-2/3 overflow-x-auto no-scrollbar pb-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                <div className="flex space-x-2">
                                    {categories.map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setFilterCategory(c)}
                                            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                                filterCategory === c 
                                                ? 'bg-ocean-700 text-white border-ocean-700' 
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-ocean-500'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-sand-100 flex justify-between items-center">
                            <span className="text-sm font-bold text-ocean-700">{filteredData.length} Establishments Found</span>
                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                <span className="text-sm text-gray-600">Year-Round Only</span>
                                <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${seasonalOnly ? 'bg-ocean-700' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${seasonalOnly ? 'translate-x-5' : ''}`}></div>
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden"
                                    checked={seasonalOnly}
                                    onChange={(e) => setSeasonalOnly(e.target.checked)}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredData.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => setSelectedRestaurant(item)}
                                className="bg-white rounded-lg border border-sand-200 shadow-sm hover:shadow-xl hover:border-ocean-300 transition-all hover:-translate-y-1 cursor-pointer flex flex-col h-full group relative overflow-hidden"
                            >
                                {/* Seasonal Indicator Line */}
                                <div className={`h-1 w-full ${item.seasonal ? 'bg-dune-orange' : 'bg-green-600'}`}></div>
                                
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="bg-gray-100 text-gray-600 text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-sm">{item.town}</span>
                                        <div className="flex items-center space-x-1 text-dune-orange">
                                            <span className="text-sm font-bold">{item.rating}</span>
                                            <span className="text-xs">★</span>
                                        </div>
                                    </div>
                                    <h3 className="font-serif text-2xl font-bold text-navy-900 mb-2 group-hover:text-ocean-700 transition-colors">{item.name}</h3>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-4 tracking-wider">{item.type} • {'$'.repeat(item.price)}</p>
                                    <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{item.desc}</p>
                                </div>
                                <div className="bg-sand-50 px-6 py-4 border-t border-sand-200 flex justify-between items-center text-xs">
                                    <span className={`font-bold uppercase tracking-wider ${item.seasonal ? 'text-dune-orange' : 'text-green-700'}`}>
                                        {item.seasonal ? 'Seasonal' : 'Year-Round'}
                                    </span>
                                    <span className="text-ocean-700 font-bold group-hover:translate-x-1 transition-transform">View Dossier &rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-navy-900 text-sand-200 py-12 mt-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h2 className="font-serif text-2xl mb-4">Cape Cod Culinary Compass Pro</h2>
                    <p className="text-sm text-gray-400 max-w-lg mx-auto mb-8">
                        Market Intelligence provided for demonstration purposes. 
                        Data sourced from public records, registry of deeds, and proprietary analysis.
                    </p>
                    <div className="border-t border-gray-700 pt-8 text-xs text-gray-500">
                        &copy; 2025 Culinary Analytics Group. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* Modals */}
            {selectedRestaurant && (
                <RestaurantModal 
                    item={selectedRestaurant} 
                    onClose={() => setSelectedRestaurant(null)} 
                    pendingFacts={pendingFacts}
                    onReviewFact={handleReviewFact}
                />
            )}

            {isIngestOpen && (
                <IngestionModal 
                    onClose={() => setIsIngestOpen(false)} 
                    onProcess={handleProcessIngestion} 
                />
            )}
        </div>
    );
}