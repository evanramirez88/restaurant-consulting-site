import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Monitor, 
  Printer, 
  Server, 
  Wifi, 
  Coffee,
  Download,
  Mail,
  RefreshCw,
  Info
} from 'lucide-react';
import { StationType, StationConfig, PlacedStation, QuoteState } from '../types';
import { STATION_CONFIGS, PRICING_CONSTANTS } from '../constants';

const QuoteBuilder: React.FC = () => {
  const [stations, setStations] = useState<PlacedStation[]>([]);
  const [travelZone, setTravelZone] = useState<number>(0);
  const [cablingNeeded, setCablingNeeded] = useState<boolean>(false);
  const [trainingHours, setTrainingHours] = useState<number>(4);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add station to center of canvas (simulated drop)
  const addStation = (type: StationType) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Randomize position slightly for visual stacking
    const x = 50 + Math.random() * 20; 
    const y = 50 + Math.random() * 20;
    
    setStations([...stations, { id, type, x, y }]);
  };

  const removeStation = (id: string) => {
    setStations(stations.filter(s => s.id !== id));
  };

  // Drag logic
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setStations(stations.map(s => 
      s.id === draggingId ? { ...s, x, y } : s
    ));
    setDraggingId(null);
  };

  // Calculations
  const calculateTotal = () => {
    const hardwareTotal = stations.reduce((sum, station) => {
      return sum + STATION_CONFIGS[station.type].baseCost;
    }, 0);

    const laborTotal = stations.length * 150; // Simple labor calc per station
    const travelCost = PRICING_CONSTANTS.TRAVEL_ZONES[travelZone];
    const cablingCost = cablingNeeded ? stations.length * PRICING_CONSTANTS.CABLING_PER_DROP : 0;
    const trainingCost = trainingHours * PRICING_CONSTANTS.TRAINING_RATE;

    return hardwareTotal + laborTotal + travelCost + cablingCost + trainingCost;
  };

  const totalCost = calculateTotal();

  return (
    <div className="bg-slate-100 min-h-screen pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-brand-dark">Interactive Quote Builder</h1>
          <p className="text-slate-600 mt-2">Drag stations onto the floor plan to estimate your installation costs instantly.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Sidebar: Toolbox */}
          <div className="lg:w-1/4 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-brand-accent" /> Add Stations
              </h3>
              <div className="space-y-3">
                {Object.values(STATION_CONFIGS).map((config) => (
                  <button
                    key={config.type}
                    onClick={() => addStation(config.type)}
                    className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand-accent/50 rounded-lg transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      {config.type.includes('Expo') ? <Monitor size={18} className="text-slate-500 group-hover:text-brand-accent" /> :
                       config.type.includes('Server') ? <Server size={18} className="text-slate-500 group-hover:text-brand-accent" /> :
                       config.type.includes('Bar') ? <Coffee size={18} className="text-slate-500 group-hover:text-brand-accent" /> :
                       <Printer size={18} className="text-slate-500 group-hover:text-brand-accent" />}
                      <span className="text-sm font-medium text-slate-700">{config.type}</span>
                    </div>
                    <Plus size={16} className="text-slate-300 group-hover:text-brand-accent" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <RefreshCw size={18} className="text-brand-accent" /> Project Details
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Travel Zone</label>
                  <select 
                    value={travelZone}
                    onChange={(e) => setTravelZone(Number(e.target.value))}
                    className="w-full text-sm border-slate-200 rounded-md focus:ring-brand-accent focus:border-brand-accent"
                  >
                    <option value={0}>Local (Cape Cod) - Free</option>
                    <option value={1}>Mid-Range (MA/RI) - ${PRICING_CONSTANTS.TRAVEL_ZONES[1]}</option>
                    <option value={2}>Extended (New England) - ${PRICING_CONSTANTS.TRAVEL_ZONES[2]}</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    Network Cabling Needed?
                    <div className="group relative">
                      <Info size={14} className="text-slate-400 cursor-help" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded hidden group-hover:block z-50">
                        Select if you need us to run CAT6 cables to each station.
                      </span>
                    </div>
                  </label>
                  <input 
                    type="checkbox" 
                    checked={cablingNeeded}
                    onChange={(e) => setCablingNeeded(e.target.checked)}
                    className="h-4 w-4 text-brand-accent focus:ring-brand-accent border-gray-300 rounded"
                  />
                </div>

                <div>
                   <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Training Hours ({trainingHours})</label>
                   <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    value={trainingHours}
                    onChange={(e) => setTrainingHours(Number(e.target.value))}
                    className="w-full accent-brand-accent"
                   />
                </div>
              </div>
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="lg:w-1/2">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden h-[600px] relative flex flex-col">
               <div className="absolute top-0 left-0 right-0 bg-slate-50 border-b border-slate-100 px-4 py-2 flex justify-between items-center z-10">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Floor Plan Visualizer</span>
                 <span className="text-xs text-slate-400">Drag items to position</span>
               </div>
               
               {/* The Grid / Drop Zone */}
               <div 
                ref={canvasRef}
                className="flex-grow relative bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] bg-slate-50"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
               >
                  {stations.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300 pointer-events-none">
                      <div className="text-center">
                        <Plus size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Select stations from the left to begin</p>
                      </div>
                    </div>
                  )}

                  {stations.map((station) => (
                    <div
                      key={station.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, station.id)}
                      style={{ 
                        left: `${station.x}%`, 
                        top: `${station.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      className="absolute cursor-move group"
                    >
                      <div className="relative">
                        {/* Icon Container */}
                        <div className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center border-2 transition-colors ${
                          station.type.includes('Expo') ? 'bg-blue-50 border-blue-500 text-blue-600' :
                          station.type.includes('Bar') ? 'bg-amber-50 border-amber-500 text-amber-600' :
                          'bg-white border-slate-600 text-slate-700'
                        }`}>
                           {station.type.includes('Expo') ? <Monitor size={20} /> :
                            station.type.includes('Bar') ? <Coffee size={20} /> :
                            <Server size={20} />}
                        </div>
                        
                        {/* Remove Button (Hover) */}
                        <button 
                          onClick={() => removeStation(station.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                        
                        {/* Label */}
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none">
                          {station.type}
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:w-1/4">
             <div className="bg-brand-dark text-white p-6 rounded-xl shadow-xl sticky top-24">
               <h3 className="font-serif text-xl font-bold mb-6 border-b border-slate-700 pb-4">Estimated Quote</h3>
               
               <div className="space-y-3 mb-6 text-sm">
                 <div className="flex justify-between">
                   <span className="text-slate-400">Stations ({stations.length})</span>
                   <span>${stations.reduce((sum, s) => sum + STATION_CONFIGS[s.type].baseCost, 0).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-slate-400">Installation Labor</span>
                   <span>${(stations.length * 150).toLocaleString()}</span>
                 </div>
                 {cablingNeeded && (
                   <div className="flex justify-between">
                     <span className="text-slate-400">Cabling Runs</span>
                     <span>${(stations.length * PRICING_CONSTANTS.CABLING_PER_DROP).toLocaleString()}</span>
                   </div>
                 )}
                 {travelZone > 0 && (
                   <div className="flex justify-between">
                     <span className="text-slate-400">Travel Fee</span>
                     <span>${PRICING_CONSTANTS.TRAVEL_ZONES[travelZone]}</span>
                   </div>
                 )}
                 <div className="flex justify-between">
                   <span className="text-slate-400">Training ({trainingHours} hrs)</span>
                   <span>${(trainingHours * PRICING_CONSTANTS.TRAINING_RATE).toLocaleString()}</span>
                 </div>
               </div>

               <div className="border-t border-slate-700 pt-4 mb-8">
                 <div className="flex justify-between items-end">
                   <span className="text-slate-400 font-medium">Total Estimate</span>
                   <span className="text-3xl font-bold text-brand-accent">${totalCost.toLocaleString()}</span>
                 </div>
                 <p className="text-xs text-slate-500 mt-2">*This is a preliminary estimate. Final quote subject to site survey.</p>
               </div>

               <div className="space-y-3">
                 <button 
                  onClick={() => setShowEmailModal(true)}
                  className="w-full py-3 bg-brand-accent text-white rounded-lg font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                 >
                   <Mail size={18} /> Email Me This Quote
                 </button>
                 <button className="w-full py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                   <Download size={18} /> Download PDF
                 </button>
               </div>
             </div>
          </div>

        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-serif text-2xl font-bold text-brand-dark mb-2">Save Your Quote</h3>
            <p className="text-slate-600 mb-4 text-sm">Enter your details and I'll send you this itemized breakdown immediately.</p>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowEmailModal(false); alert('Quote sent! (Simulation)'); }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant Name</label>
                <input type="text" className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-accent focus:border-brand-accent" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEmailModal(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-brand-dark text-white rounded-md hover:bg-slate-800">Send Quote</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteBuilder;