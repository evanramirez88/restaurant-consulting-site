import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';
import {
  Plus,
  Trash2,
  Download,
  Mail,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  MapPin,
  Layers,
  Cable,
  Building2,
  Save,
  Calendar,
  Wrench,
  Loader2,
  Undo2,
  Redo2,
  X,
  PanelLeftClose,
  PanelRightClose,
  GripVertical,
  Maximize2,
  Minimize2,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

// ============================================
// COMING SOON FLAG - Set to false when ready to launch
// This is the local fallback. The API flag takes precedence.
// ============================================
const SHOW_COMING_SOON = true;
import { useSEO } from '../src/components/SEO';
import {
  AdvancedStation,
  FloorObject,
  FloorLabel,
  Floor,
  Location,
  TravelRates,
  Rates,
  Selection,
  SupportPeriod,
  HardwareItem,
  IntegrationItem,
  StationTemplate,
  ObjectDefinition,
  HardwareAssociation,
  CableRun,
  TravelSettings,
  ExtractedHardware,
  ImportStatus
} from '../types';
import {
  HARDWARE_CATALOG,
  INTEGRATIONS,
  STATION_TEMPLATES,
  COMMON_STATION_NAMES,
  FOH_OBJECTS,
  BOH_OBJECTS,
  STRUCTURE_OBJECTS,
  DEFAULT_RATES,
  DEFAULT_TRAVEL,
  STATION_OVERHEAD_MIN,
  SUPPORT_TIERS,
  LS_KEY,
  TRAVEL_ZONE_LABELS
} from '../constants';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const deepClone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const minutesToHm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
};

// Local storage hook
function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage errors
    }
  }, [key, state]);

  return [state, setState];
}

// ============================================
// DEFAULT FACTORIES
// ============================================

const createDefaultFloor = (): Floor => ({
  id: uid(),
  name: "Main Floor",
  stations: [],
  objects: [],
  labels: [],
  layers: [
    { id: uid(), name: "Base Layout", type: "base", visible: true, cableRuns: [] },
    { id: uid(), name: "Networking & Cabling", type: "network", visible: true, cableRuns: [] }
  ],
  scalePxPerFt: 16
});

const createNetworkingStation = (x = 60, y = 60): AdvancedStation => ({
  id: uid(),
  name: "Networking Area",
  type: "Networking Area",
  color: "#14b8a6",
  x,
  y,
  w: 260,
  h: 170,
  nickname: "",
  notes: "Network closet / Toast Hub",
  dept: "BOH",
  flags: { existing: false, replace: false },
  hardware: [
    { hid: "router", nickname: "", notes: "", flags: { existing: false, replace: false } },
    { hid: "poe-switch", nickname: "", notes: "", flags: { existing: false, replace: false } }
  ]
});

const createDefaultLocation = (): Location => {
  const floor = createDefaultFloor();
  floor.stations.push(createNetworkingStation());
  return {
    id: uid(),
    name: "My Restaurant",
    address: "",
    travel: { zone: "cape", islandVehicle: false, lodging: false, remote: false },
    subscriptionPct: 0,
    integrationIds: [],
    floors: [floor]
  };
};

// ============================================
// ADDRESS CLASSIFICATION
// ============================================

function classifyAddress(addr: string): Partial<TravelSettings> {
  const a = (addr || "").toLowerCase();
  const isNantucket = a.includes("nantucket");
  const isMV = a.includes("martha") || a.includes("oak bluffs") || a.includes("edgartown") || a.includes("vineyard");
  const isCape = a.includes("cape cod") || ["barnstable", "falmouth", "provincetown", "hyannis", "sandwich", "dennis", "yarmouth", "brewster", "chatham", "wellfleet", "eastham", "harwich"].some(t => a.includes(t));

  if (isNantucket || isMV) return { zone: "island" };
  if (isCape) return { zone: "cape" };

  const south = ["plymouth", "kingston", "duxbury", "marshfield", "scituate", "hingham", "quincy", "weymouth", "braintree", "norwell", "hanover", "cohasset"];
  if (south.some(t => a.includes(t))) return { zone: "southShore" };

  const ne = ["connecticut", "rhode", "new hampshire", "vermont", "maine", "massachusetts"];
  if (ne.some(t => a.includes(t))) return { zone: "southernNE" };

  return { zone: "outOfRegion" };
}

// ============================================
// COLLAPSIBLE PANEL COMPONENT
// ============================================
interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
  maxHeight?: string;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  badge,
  maxHeight = '300px'
}) => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden transition-all duration-200">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
    >
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex-1">{title}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full">{badge}</span>
      )}
      <span className="text-slate-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        <ChevronDown size={16} />
      </span>
    </button>
    <div
      className="transition-all duration-200 ease-in-out"
      style={{
        maxHeight: isOpen ? maxHeight : '0px',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden'
      }}
    >
      <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 16px)` }}>
        {children}
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const QuoteBuilder: React.FC = () => {
  useSEO({
    title: 'Toast POS Quote Builder | Cape Cod Restaurant Consulting',
    description: 'Build your custom Toast POS installation quote. Design floor plans, select hardware, and get instant pricing for your Cape Cod restaurant.',
    canonical: 'https://ccrestaurantconsulting.com/#/quote',
  });

  // Feature flag state
  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(!SHOW_COMING_SOON);

  // Check feature flag from API on load
  // Admin users and demo mode (?demo=true) always have access
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // Check if demo mode is enabled via URL parameter
        // Support both ?demo=true and #/path?demo=true (hash routing)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const authResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const authData = await authResponse.json();
          isAdmin = authData.authenticated === true;
        } catch {
          // Not authenticated, continue with feature flag check
        }

        // Admin and demo mode always have access
        if (isDemoMode || isAdmin) {
          setIsFeatureEnabled(true);
          setFeatureFlagLoading(false);
          return;
        }

        // Check feature flag for regular users
        const response = await fetch('/api/admin/feature-flags');
        const result = await response.json();
        if (result.success && result.data?.flags) {
          setIsFeatureEnabled(result.data.flags.quote_builder_enabled === true);
        }
      } catch (error) {
        console.error('Failed to check feature flag:', error);
        // Fall back to local constant
        setIsFeatureEnabled(!SHOW_COMING_SOON);
      } finally {
        setFeatureFlagLoading(false);
      }
    };
    checkFeatureFlag();
  }, []);

  // Persistent state
  const [rates] = usePersistentState<Rates>(LS_KEY + ":rates", DEFAULT_RATES);
  const [travel] = usePersistentState<TravelRates>(LS_KEY + ":travel", DEFAULT_TRAVEL);
  const [hardwareCatalog] = usePersistentState<HardwareItem[]>(LS_KEY + ":hardware", HARDWARE_CATALOG);
  const [integrations] = usePersistentState<IntegrationItem[]>(LS_KEY + ":integrations", INTEGRATIONS);
  const [supportTier, setSupportTier] = usePersistentState<number>(LS_KEY + ":supportTier", 0);
  const [supportPeriod, setSupportPeriod] = usePersistentState<SupportPeriod>(LS_KEY + ":supportPeriod", "monthly");
  const [locations, setLocations] = usePersistentState<Location[]>(LS_KEY + ":locations", [createDefaultLocation()]);
  const [locId, setLocId] = usePersistentState<string>(LS_KEY + ":locId", locations[0]?.id || "");

  // UI state
  const [selected, setSelected] = useState<Selection>({ kind: null, id: null });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mode, setMode] = useState<'idle' | 'addCable'>('idle');
  const [pendingCableStart, setPendingCableStart] = useState<{ x: number; y: number } | null>(null);
  const [leftOpen, setLeftOpen] = usePersistentState(LS_KEY + ":leftOpen", true);
  const [rightOpen, setRightOpen] = usePersistentState(LS_KEY + ":rightOpen", true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ name: '', email: '', restaurantName: '', phone: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  // PDF Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedHardware[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Panel collapse states for left sidebar
  const [leftPanels, setLeftPanels] = usePersistentState(LS_KEY + ":leftPanels", {
    stations: true,
    templates: true,
    hardware: false,
    objects: false
  });

  // Panel collapse states for right sidebar
  const [rightPanels, setRightPanels] = usePersistentState(LS_KEY + ":rightPanels", {
    integrations: true,
    travel: true,
    summary: true
  });

  // Toggle panel helper
  const toggleLeftPanel = (panel: keyof typeof leftPanels) => {
    setLeftPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };
  const toggleRightPanel = (panel: keyof typeof rightPanels) => {
    setRightPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Undo/Redo history
  const [history, setHistory] = useState<Location[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Derived state
  const currentLocation = useMemo(() =>
    locations.find(l => l.id === locId) || locations[0],
    [locations, locId]
  );

  const [floorId, setFloorId] = usePersistentState<string>(
    LS_KEY + ":floorId",
    currentLocation?.floors[0]?.id || ""
  );

  const currentFloor = useMemo(() =>
    currentLocation?.floors.find(f => f.id === floorId) || currentLocation?.floors[0],
    [currentLocation, floorId]
  );

  const [activeLayerId, setActiveLayerId] = usePersistentState<string>(
    LS_KEY + ":layerId",
    currentFloor?.layers[0]?.id || ""
  );

  const activeLayer = useMemo(() =>
    currentFloor?.layers.find(l => l.id === activeLayerId) || currentFloor?.layers[0],
    [currentFloor, activeLayerId]
  );

  // Hardware lookup
  const hwById = useMemo(() =>
    Object.fromEntries(hardwareCatalog.map(h => [h.id, h])),
    [hardwareCatalog]
  );

  // Keep floor/layer valid on switches
  useEffect(() => {
    if (!currentLocation) return;
    if (!currentLocation.floors.find(f => f.id === floorId)) {
      setFloorId(currentLocation.floors[0]?.id || "");
    }
    if (currentFloor && !currentFloor.layers.find(l => l.id === activeLayerId)) {
      setActiveLayerId(currentFloor.layers[0]?.id || "");
    }
  }, [currentLocation, floorId, currentFloor, activeLayerId, setFloorId, setActiveLayerId]);

  // Track history for undo/redo (debounced)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(deepClone(locations));
        // Keep only last 50 states
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [locations]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLocations(deepClone(history[newIndex]));
    }
  }, [history, historyIndex, setLocations]);

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLocations(deepClone(history[newIndex]));
    }
  }, [history, historyIndex, setLocations]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // ============================================
  // STATE HELPERS
  // ============================================

  const updateCurrentLocation = useCallback((patchFn: (loc: Location) => Location) => {
    setLocations(prev => prev.map(l => l.id !== currentLocation?.id ? l : patchFn(deepClone(l))));
  }, [currentLocation?.id, setLocations]);

  const addLocation = () => {
    const n = createDefaultLocation();
    n.name = `Location ${locations.length + 1}`;
    setLocations(prev => [...prev, n]);
    setLocId(n.id);
    setFloorId(n.floors[0].id);
    setActiveLayerId(n.floors[0].layers[0].id);
  };

  const addFloor = () => {
    updateCurrentLocation(loc => {
      const f = createDefaultFloor();
      f.name = `Floor ${loc.floors.length + 1}`;
      loc.floors.push(f);
      return loc;
    });
  };

  const addLayer = () => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.layers.push({
          id: uid(),
          name: `Layer ${f.layers.length + 1}`,
          type: "generic",
          visible: true,
          cableRuns: []
        });
      }
      return loc;
    });
  };

  const toggleLayerVisibility = (layerId: string) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.layers = f.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
      }
      return loc;
    });
  };

  // ============================================
  // PDF IMPORT FUNCTIONS
  // ============================================

  const handleImportPdf = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setImportError('Please select a PDF file');
      return;
    }

    setImportStatus('uploading');
    setImportError(null);
    setExtractedItems([]);

    try {
      // Read PDF and extract text using PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      setImportStatus('processing');

      // Extract text from all pages
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      console.log('Extracted', fullText.length, 'characters from PDF');

      // Send extracted text to API for parsing
      const parseRes = await fetch('/api/quote/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          fileName: file.name
        })
      });

      const parseData = await parseRes.json();
      if (!parseData.success) {
        throw new Error(parseData.error || 'Parsing failed');
      }

      setExtractedItems(parseData.extractedItems || []);
      setImportStatus('complete');

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
      setImportStatus('error');
    }
  };

  const importExtractedHardware = () => {
    if (extractedItems.length === 0) return;

    // Create a new "Imported Hardware" station with the extracted items
    const importedStation: AdvancedStation = {
      id: uid(),
      name: 'Imported Hardware',
      type: 'Imported',
      color: '#8b5cf6', // Purple to distinguish
      x: 100,
      y: 100,
      w: 300,
      h: 200,
      nickname: 'From Toast PDF',
      notes: `Imported ${new Date().toLocaleDateString()}`,
      dept: 'FOH',
      flags: { existing: false, replace: false },
      hardware: []
    };

    // Add each extracted item with proper quantities
    for (const item of extractedItems) {
      for (let i = 0; i < item.quantity; i++) {
        for (const hid of item.mappedHardwareIds) {
          importedStation.hardware.push({
            hid,
            nickname: item.productName.substring(0, 30),
            notes: '',
            flags: { existing: false, replace: false }
          });
        }
      }
    }

    // Add station to current floor
    updateCurrentLocation(loc => {
      const floor = loc.floors.find(f => f.id === currentFloor?.id);
      if (floor) {
        floor.stations.push(importedStation);
      }
      return loc;
    });

    // Select the new station
    setSelected({ kind: 'station', id: importedStation.id });

    // Close modal and reset state
    setShowImportModal(false);
    setExtractedItems([]);
    setImportStatus('idle');
    setImportJobId(null);
    setImportError(null);
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setExtractedItems([]);
    setImportStatus('idle');
    setImportJobId(null);
    setImportError(null);
    if (importFileRef.current) {
      importFileRef.current.value = '';
    }
  };

  // Station operations
  const addStation = (type: string) => {
    const s: AdvancedStation = {
      id: uid(),
      name: type,
      type,
      color: "#2dd4bf",
      x: 120,
      y: 120,
      w: 240,
      h: 160,
      hardware: [],
      nickname: "",
      notes: "",
      dept: "",
      flags: { existing: false, replace: false }
    };
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.stations.push(s);
      return loc;
    });
    setSelected({ kind: "station", id: s.id });
  };

  const addTemplateStation = (tmpl: StationTemplate) => {
    const s: AdvancedStation = {
      id: uid(),
      name: tmpl.label,
      type: tmpl.label,
      color: tmpl.color,
      x: 140,
      y: 140,
      w: 240,
      h: 160,
      nickname: "",
      notes: "",
      dept: "",
      flags: { existing: false, replace: false },
      hardware: tmpl.items.map(hid => ({
        hid,
        nickname: "",
        notes: "",
        flags: { existing: false, replace: false }
      }))
    };
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.stations.push(s);
      return loc;
    });
    setSelected({ kind: "station", id: s.id });
  };

  const updateStation = (id: string, patch: Partial<AdvancedStation>) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.stations = f.stations.map(s => s.id === id ? { ...s, ...patch } : s);
      }
      return loc;
    });
  };

  const removeStation = (id: string) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.stations = f.stations.filter(s => s.id !== id);
        // Ensure at least one networking area exists
        if (!f.stations.some(s => s.type === "Networking Area")) {
          f.stations.unshift(createNetworkingStation(60, 60));
        }
      }
      return loc;
    });
    if (selected.kind === "station" && selected.id === id) {
      setSelected({ kind: null, id: null });
    }
  };

  // Object operations
  const addObject = (objDef: ObjectDefinition) => {
    const o: FloorObject = {
      id: uid(),
      kind: "object",
      type: objDef.type,
      x: 100,
      y: 100,
      w: objDef.w,
      h: objDef.h,
      color: objDef.color,
      rot: 0
    };
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.objects.push(o);
      return loc;
    });
    setSelected({ kind: "object", id: o.id });
  };

  const updateObject = (id: string, patch: Partial<FloorObject>) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.objects = f.objects.map(o => o.id === id ? { ...o, ...patch } : o);
      }
      return loc;
    });
  };

  const removeObject = (id: string) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.objects = f.objects.filter(o => o.id !== id);
      return loc;
    });
    if (selected.kind === "object" && selected.id === id) {
      setSelected({ kind: null, id: null });
    }
  };

  // Label operations
  const addLabel = () => {
    const l: FloorLabel = {
      id: uid(),
      kind: "label",
      text: "Label",
      x: 150,
      y: 150,
      rot: 0
    };
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.labels.push(l);
      return loc;
    });
    setSelected({ kind: "label", id: l.id });
  };

  const updateLabel = (id: string, patch: Partial<FloorLabel>) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.labels = f.labels.map(l => l.id === id ? { ...l, ...patch } : l);
      }
      return loc;
    });
  };

  const removeLabel = (id: string) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) f.labels = f.labels.filter(l => l.id !== id);
      return loc;
    });
    if (selected.kind === "label" && selected.id === id) {
      setSelected({ kind: null, id: null });
    }
  };

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to deselect
      if (e.key === 'Escape') {
        setSelected({ kind: null, id: null });
        setMode('idle');
        setPendingCableStart(null);
        setIsPanning(false);
        return;
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Space key to enable pan mode
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setIsPanning(true);
      }

      // Delete key to remove selected item
      if (e.key === 'Delete' && selected.kind && selected.id) {
        e.preventDefault();
        if (selected.kind === 'station') {
          removeStation(selected.id);
        } else if (selected.kind === 'object') {
          removeObject(selected.id);
        } else if (selected.kind === 'label') {
          removeLabel(selected.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsPanning(false);
        panStartRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selected, undo, redo]);

  // Hardware operations
  const addHardwareToStation = (stationId: string, hid: string) => {
    const st = currentFloor?.stations.find(s => s.id === stationId);
    if (!st) return;
    updateStation(stationId, {
      hardware: [...st.hardware, { hid, nickname: "", notes: "", flags: { existing: false, replace: false } }]
    });
  };

  const removeHardwareFromStation = (stationId: string, idx: number) => {
    const st = currentFloor?.stations.find(s => s.id === stationId);
    if (!st) return;
    const arr = st.hardware.slice();
    arr.splice(idx, 1);
    updateStation(stationId, { hardware: arr });
  };

  const updateHardwareAssoc = (stationId: string, idx: number, patch: Partial<HardwareAssociation>) => {
    const st = currentFloor?.stations.find(s => s.id === stationId);
    if (!st) return;
    const arr = st.hardware.slice();
    arr[idx] = { ...arr[idx], ...patch };
    updateStation(stationId, { hardware: arr });
  };

  // Integration toggle
  const toggleIntegration = (id: string) => {
    updateCurrentLocation(loc => {
      const set = new Set(loc.integrationIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      loc.integrationIds = [...set];
      return loc;
    });
  };

  // Address & Travel
  const setAddress = (addr: string) => {
    updateCurrentLocation(loc => {
      loc.address = addr;
      if (!loc.travel.remote) {
        loc.travel = { ...loc.travel, ...classifyAddress(addr) };
      }
      return loc;
    });
  };

  // Cable runs
  const canvasClick = (e: React.MouseEvent) => {
    if (mode !== "addCable" || activeLayer?.type !== "network") return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (!pendingCableStart) {
      setPendingCableStart({ x, y });
    } else {
      const start = pendingCableStart;
      const end = { x, y };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const pxDist = Math.sqrt(dx * dx + dy * dy);
      const ft = Math.max(1, +(pxDist / (currentFloor?.scalePxPerFt || 16)).toFixed(1));
      const tti = Math.round(20 + (ft / 25) * 10);

      updateCurrentLocation(loc => {
        const f = loc.floors.find(fl => fl.id === currentFloor?.id);
        const layer = f?.layers.find(l => l.id === activeLayer?.id);
        if (layer) {
          layer.cableRuns.push({ id: uid(), from: start, to: end, lengthFt: ft, ttiMin: tti });
        }
        return loc;
      });
      setPendingCableStart(null);
      setMode("idle");
    }
  };

  const removeCable = (layerId: string, runId: string) => {
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      const layer = f?.layers.find(l => l.id === layerId);
      if (layer) {
        layer.cableRuns = layer.cableRuns.filter(r => r.id !== runId);
      }
      return loc;
    });
  };

  // Pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or Space+Left click for panning
    if (e.button === 1 || (isPanning && e.button === 0)) {
      e.preventDefault();
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
    }
  };

  const handleCanvasMouseUp = () => {
    panStartRef.current = null;
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    // Ctrl+scroll for zoom, regular scroll for pan
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.25, Math.min(3, +(z + delta).toFixed(2))));
    } else {
      // Pan with scroll wheel
      setPan(p => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY
      }));
    }
  };

  const resetPan = () => {
    setPan({ x: 0, y: 0 });
  };

  const resetFloor = () => {
    if (!confirm('Clear all stations/objects/labels/cables on this floor?')) return;
    updateCurrentLocation(loc => {
      const f = loc.floors.find(fl => fl.id === currentFloor?.id);
      if (f) {
        f.stations = [createNetworkingStation(60, 60)];
        f.objects = [];
        f.labels = [];
        f.layers = f.layers.map(l => ({ ...l, cableRuns: [] }));
      }
      return loc;
    });
    setSelected({ kind: null, id: null });
  };

  // ============================================
  // DRAG & RESIZE HANDLERS
  // ============================================

  const dragStart = (e: React.MouseEvent, kind: Selection['kind'], id: string) => {
    e.stopPropagation();
    setSelected({ kind, id });

    const startX = e.clientX;
    const startY = e.clientY;
    const scale = zoom;

    let item: AdvancedStation | FloorObject | FloorLabel | undefined;
    if (kind === 'station') item = currentFloor?.stations.find(s => s.id === id);
    if (kind === 'object') item = currentFloor?.objects.find(o => o.id === id);
    if (kind === 'label') item = currentFloor?.labels.find(l => l.id === id);

    if (!item) return;
    const startPos = { x: item.x, y: item.y };

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const nx = Math.round((startPos.x + dx) / 2) * 2;
      const ny = Math.round((startPos.y + dy) / 2) * 2;

      if (kind === 'station') updateStation(id, { x: clamp(nx, 0, 4000), y: clamp(ny, 0, 3000) });
      if (kind === 'object') updateObject(id, { x: clamp(nx, 0, 4000), y: clamp(ny, 0, 3000) });
      if (kind === 'label') updateLabel(id, { x: clamp(nx, 0, 4000), y: clamp(ny, 0, 3000) });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const resizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const scale = zoom;
    const st = currentFloor?.stations.find(s => s.id === id);
    if (!st) return;
    const start = { w: st.w || 240, h: st.h || 160 };

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const nw = Math.max(160, Math.round((start.w + dx) / 2) * 2);
      const nh = Math.max(120, Math.round((start.h + dy) / 2) * 2);
      updateStation(id, { w: nw, h: nh });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ============================================
  // TRAVEL COST CALCULATION
  // ============================================

  const computeTravelCost = useCallback((loc: Location) => {
    if (loc.travel?.remote) return 0;
    const z = loc.travel?.zone || 'cape';
    if (z === 'cape') return travel.capeCod;
    if (z === 'southShore') return travel.southShore;
    if (z === 'southernNE') return travel.southernNE;
    if (z === 'ne100+') return travel.newEngland100Plus;
    if (z === 'island') {
      let c = travel.islandBase;
      if (loc.travel?.islandVehicle) c += travel.islandVehicle;
      if (loc.travel?.lodging) c += travel.islandLodging;
      return c;
    }
    if (z === 'outOfRegion') return travel.outOfRegionBase;
    return 0;
  }, [travel]);

  // ============================================
  // SERVER-SIDE ESTIMATION ENGINE
  // ============================================

  // State for server-calculated quote
  const [serverQuote, setServerQuote] = useState<{
    items: Array<{ type: string; label: string; cost: number }>;
    summary: {
      hardwareCost: number;
      overheadCost: number;
      integrationsCost: number;
      cablingCost: number;
      installCost: number;
      travelCost: number;
      supportMonthly: number;
      supportAnnual: number;
      totalFirst: number;
    };
    timeEstimate: { minHours: number; maxHours: number };
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Debounced quote calculation from server
  useEffect(() => {
    if (!currentLocation || !currentFloor) return;

    const calculateQuote = async () => {
      setQuoteLoading(true);
      try {
        const response = await fetch('/api/quote/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            floors: currentLocation.floors,
            travel: currentLocation.travel,
            integrationIds: currentLocation.integrationIds,
            supportTier,
            supportPeriod
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setServerQuote(data.quote);
          }
        }
      } catch (error) {
        console.error('Quote calculation error:', error);
      } finally {
        setQuoteLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(calculateQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [currentLocation, currentFloor, supportTier, supportPeriod]);

  // Estimate object compatible with existing UI
  const estimate = useMemo(() => {
    if (!serverQuote) return {
      items: [],
      mins: { hardware: 0, overhead: 0, integrations: 0, cabling: 0 },
      totalMin: 0,
      installCost: 0,
      travelCost: 0,
      supportMonthly: 0,
      supportAnnual: 0,
      combinedFirst: 0
    };

    return {
      items: serverQuote.items.map(item => ({
        type: item.type,
        label: item.label,
        minutes: 0, // Minutes are not exposed from server
        dollars: item.cost
      })),
      mins: {
        hardware: 0, // Actual minutes are server-side only
        overhead: 0,
        integrations: 0,
        cabling: 0
      },
      totalMin: 0, // Time estimate is provided as range only
      timeEstimate: serverQuote.timeEstimate,
      installCost: serverQuote.summary.installCost,
      travelCost: serverQuote.summary.travelCost,
      supportMonthly: serverQuote.summary.supportMonthly,
      supportAnnual: serverQuote.summary.supportAnnual,
      combinedFirst: serverQuote.summary.totalFirst
    };
  }, [serverQuote]);

  // Export JSON
  const exportJSON = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      locations,
      locId,
      floorId,
      hardwareCatalog,
      integrations,
      rates,
      travel,
      supportTier,
      supportPeriod,
      estimate
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccrc-quote-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gridSize = (currentFloor?.scalePxPerFt || 16) * zoom;

  // ============================================
  // RENDER
  // ============================================

  // Loading state while checking feature flag
  if (featureFlagLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Coming Soon overlay - shows when feature is disabled via API or local flag
  if (!isFeatureEnabled) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-xl px-6">
          <div className="text-amber-400 text-6xl mb-6">
            <Wrench className="w-16 h-16 mx-auto" />
          </div>
          <h1 className="text-4xl font-serif text-white mb-4">Quote Builder</h1>
          <p className="text-xl text-amber-400 mb-6">Coming Soon</p>
          <p className="text-gray-400 mb-8">
            We're building an intelligent quoting tool that configures your
            Toast POS installation in minutes. Get accurate pricing based on
            your specific restaurant layout and needs.
          </p>
          <Link
            to="/contact"
            className="inline-block px-6 py-3 rounded transition-colors"
            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
          >
            Contact for Custom Quote
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col overflow-hidden">
      {/* Header Toolbar - Compact */}
      <header className="flex-shrink-0 border-b border-slate-700 bg-slate-900/95 backdrop-blur z-20">
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {/* Back button and title */}
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mr-2 flex-shrink-0"
          >
            <X size={18} />
          </Link>
          <h1 className="text-white font-serif font-semibold text-sm mr-4 flex-shrink-0">Quote Builder</h1>

          <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0" />

          {/* Location selector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Building2 size={14} className="text-slate-400" />
            <select
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
              value={locId}
              onChange={e => setLocId(e.target.value)}
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button onClick={addLocation} className="bg-slate-700 hover:bg-slate-600 rounded p-1.5 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Location">
              <Plus size={12} />
            </button>
          </div>

          {/* Address input */}
          <input
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white w-48 flex-shrink-0"
            placeholder="Address (auto-detects zone)"
            value={currentLocation?.address || ''}
            onChange={e => setAddress(e.target.value)}
          />

          <div className="w-px h-6 bg-slate-700 mx-1 flex-shrink-0" />

          {/* Floor selector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Layers size={14} className="text-slate-400" />
            <select
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
              value={floorId}
              onChange={e => setFloorId(e.target.value)}
            >
              {currentLocation?.floors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button onClick={addFloor} className="bg-slate-700 hover:bg-slate-600 rounded p-1.5 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Floor">
              <Plus size={12} />
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${canUndo ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${canRedo ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
          </div>

          {/* Import PDF Button */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none"
              title="Import Toast PDF"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Import PDF</span>
            </button>
          </div>

          {/* Sidebar toggles */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${leftOpen ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
              title={leftOpen ? "Hide left panel" : "Show left panel"}
            >
              <PanelLeftClose size={14} />
            </button>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${rightOpen ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
              title={rightOpen ? "Hide right panel" : "Show right panel"}
            >
              <PanelRightClose size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`flex-shrink-0 border-r border-slate-700 bg-slate-900/95 flex flex-col transition-all duration-300 ease-in-out ${leftOpen ? 'w-72' : 'w-0'}`}
          style={{ overflow: leftOpen ? 'visible' : 'hidden' }}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ display: leftOpen ? 'block' : 'none' }}>
            {/* Add Station Panel */}
            <CollapsiblePanel
              title="Add Station"
              icon={<Plus size={14} />}
              isOpen={leftPanels.stations}
              onToggle={() => toggleLeftPanel('stations')}
              badge={currentFloor?.stations.length || 0}
              maxHeight="200px"
            >
              <div className="space-y-2">
                <button
                  onClick={() => addStation('Blank Station')}
                  className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  + Blank Station
                </button>
                <select
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  onChange={e => { if (e.target.value) addStation(e.target.value); e.target.value = ''; }}
                  defaultValue=""
                >
                  <option value="" disabled>Common Names...</option>
                  {COMMON_STATION_NAMES.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </CollapsiblePanel>

            {/* Templates Panel */}
            <CollapsiblePanel
              title="Station Templates"
              icon={<Layers size={14} />}
              isOpen={leftPanels.templates}
              onToggle={() => toggleLeftPanel('templates')}
              maxHeight="280px"
            >
              <div className="space-y-1.5">
                {STATION_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => addTemplateStation(t)}
                    className="w-full text-left px-3 py-2 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: t.color }}>{t.label}</span>
                      <span className="text-xs text-slate-400">{t.ttiMin}m</span>
                    </div>
                  </button>
                ))}
              </div>
            </CollapsiblePanel>

            {/* Hardware Catalog Panel */}
            <CollapsiblePanel
              title="Hardware Catalog"
              icon={<Wrench size={14} />}
              isOpen={leftPanels.hardware}
              onToggle={() => toggleLeftPanel('hardware')}
              badge={selected.kind === 'station' ? '!' : undefined}
              maxHeight="320px"
            >
              <div className="space-y-1.5">
                {selected.kind === 'station' && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-2 border border-amber-500/30">
                    Click hardware to add to: <strong>{currentFloor?.stations.find(s => s.id === selected.id)?.name}</strong>
                  </div>
                )}
                {hardwareCatalog.map(hw => (
                  <button
                    key={hw.id}
                    onClick={() => selected.kind === 'station' ? addHardwareToStation(selected.id!, hw.id) : null}
                    disabled={selected.kind !== 'station'}
                    className={`w-full text-left border border-slate-600 rounded-lg px-3 py-2 transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                      selected.kind === 'station' ? 'hover:bg-slate-700/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">{hw.name}</div>
                    <div className="text-xs text-slate-400">{hw.category} • {hw.ttiMin}m</div>
                  </button>
                ))}
              </div>
            </CollapsiblePanel>

            {/* Objects Panel */}
            <CollapsiblePanel
              title="Floor Objects"
              icon={<MapPin size={14} />}
              isOpen={leftPanels.objects}
              onToggle={() => toggleLeftPanel('objects')}
              maxHeight="400px"
            >
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-amber-400 font-medium mb-1.5">FOH</div>
                  <div className="flex flex-wrap gap-1">
                    {FOH_OBJECTS.map(o => (
                      <button
                        key={o.type}
                        onClick={() => addObject(o)}
                        className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                      >
                        {o.type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-emerald-400 font-medium mb-1.5">BOH</div>
                  <div className="flex flex-wrap gap-1">
                    {BOH_OBJECTS.map(o => (
                      <button
                        key={o.type}
                        onClick={() => addObject(o)}
                        className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                      >
                        {o.type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-xs text-slate-400 font-medium mb-1.5">Structure</div>
                  <div className="flex flex-wrap gap-1">
                    {STRUCTURE_OBJECTS.map(o => (
                      <button
                        key={o.type}
                        onClick={() => addObject(o)}
                        className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                      >
                        {o.type}
                      </button>
                    ))}
                    <button
                      onClick={addLabel}
                      className="px-2 py-1 text-xs border border-cyan-600 bg-cyan-600/20 rounded hover:bg-cyan-600/40 text-cyan-300 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                    >
                      + Label
                    </button>
                  </div>
                </div>
              </div>
            </CollapsiblePanel>
          </div>
        </aside>

        {/* Canvas Area */}
        <div
          className="flex-1 relative overflow-hidden bg-slate-950"
          onClick={() => !isPanning && setSelected({ kind: null, id: null })}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)`,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
          />

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="absolute inset-0"
            onClick={canvasClick}
            style={{
              cursor: isPanning ? 'grab' : mode === 'addCable' ? 'crosshair' : 'default',
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              userSelect: isPanning ? 'none' : 'auto'
            }}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '2000px', minHeight: '1500px', position: 'relative' }}>
              {/* Objects */}
              {currentFloor?.objects.map(o => (
                <div
                  key={o.id}
                  className={`absolute rounded-md shadow-lg cursor-move ${selected.kind === 'object' && selected.id === o.id ? 'ring-2 ring-emerald-400' : ''}`}
                  style={{
                    left: o.x,
                    top: o.y,
                    width: o.w,
                    height: o.h,
                    backgroundColor: o.color,
                    transform: `rotate(${o.rot}deg)`
                  }}
                  onMouseDown={e => { e.stopPropagation(); dragStart(e, 'object', o.id); }}
                >
                  <div className="absolute -top-7 left-0 flex gap-1" onClick={e => e.stopPropagation()}>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { w: o.w + 10 })} aria-label="Increase width">W+</button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { w: Math.max(10, o.w - 10) })} aria-label="Decrease width">W-</button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { rot: (o.rot + 15) % 360 })} aria-label="Rotate object"><RotateCw size={10} /></button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-red-400 focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => removeObject(o.id)} aria-label="Delete object"><Trash2 size={10} /></button>
                  </div>
                  <div className="text-[10px] text-white/80 px-1">{o.type}</div>
                </div>
              ))}

              {/* Stations */}
              {currentFloor?.stations.map(st => (
                <div
                  key={st.id}
                  className={`absolute select-none rounded-xl border ${selected.kind === 'station' && selected.id === st.id ? 'border-emerald-400' : 'border-slate-600'} bg-slate-800/90 shadow-xl cursor-move`}
                  style={{ left: st.x, top: st.y, width: st.w || 240, height: st.h || 160 }}
                  onMouseDown={e => { e.stopPropagation(); dragStart(e, 'station', st.id); }}
                >
                  {/* Action rail */}
                  <div className="absolute -left-8 top-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                    <button className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-red-400 hover:bg-red-900/50 focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => removeStation(st.id)} aria-label="Delete station">
                      <Trash2 size={12} />
                    </button>
                    <button className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-slate-200 hover:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" aria-label="Duplicate station" onClick={() => {
                      const dupe = deepClone(st);
                      dupe.id = uid();
                      dupe.x += 24;
                      dupe.y += 24;
                      updateCurrentLocation(loc => {
                        const f = loc.floors.find(fl => fl.id === currentFloor?.id);
                        if (f) f.stations.push(dupe);
                        return loc;
                      });
                    }}>
                      <Copy size={12} />
                    </button>
                    <button
                      className={`w-6 h-6 rounded-full bg-slate-900 border flex items-center justify-center text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none ${st.flags?.existing ? 'border-yellow-400 text-yellow-400' : 'border-slate-600 text-slate-200'}`}
                      title="Mark as Existing"
                      aria-label="Mark station as existing"
                      onClick={() => updateStation(st.id, { flags: { ...st.flags, existing: !st.flags?.existing } })}
                    >
                      E
                    </button>
                  </div>

                  {/* Header */}
                  <div
                    className="px-3 py-1.5 border-b border-slate-600 flex items-center gap-2 rounded-t-xl"
                    style={{ background: `linear-gradient(0deg, ${st.color}22, transparent)` }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} />
                    <input
                      className="bg-transparent text-sm font-medium outline-none text-white w-32"
                      value={st.name}
                      onChange={e => updateStation(st.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                    />
                    {st.dept && <span className="ml-auto text-[10px] text-white px-2 py-0.5 rounded-full border border-slate-600">{st.dept}</span>}
                    {st.flags?.existing && !st.flags?.replace && <span className="text-[10px] text-yellow-300 ml-1">Existing</span>}
                  </div>

                  {/* Body - Hardware list */}
                  <div className="p-2 space-y-1 overflow-auto" style={{ height: 'calc(100% - 40px)' }}>
                    {st.hardware.map((assoc, idx) => {
                      const hw = hwById[assoc.hid];
                      if (!hw) return null;
                      return (
                        <div key={idx} className="relative border border-slate-600 rounded-md px-2 py-1">
                          <div className="text-[11px] flex items-center gap-2 text-white">
                            <span>{hw.name}</span>
                            <span className="text-slate-200">- {hw.ttiMin} min</span>
                            {assoc.flags?.existing && !assoc.flags?.replace && <span className="ml-auto text-[10px] text-yellow-300">Existing</span>}
                          </div>
                          <div className="absolute top-0 right-1 flex gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              className={`text-[10px] focus:ring-2 focus:ring-amber-500 focus:outline-none ${assoc.flags?.existing ? 'text-yellow-400' : 'text-slate-200'}`}
                              onClick={() => updateHardwareAssoc(st.id, idx, { flags: { ...assoc.flags, existing: !assoc.flags?.existing } })}
                              aria-label="Mark hardware as existing"
                            >
                              E
                            </button>
                            <button className="text-[10px] text-red-400 focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => removeHardwareFromStation(st.id, idx)} aria-label="Remove hardware">x</button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Quick add hardware when selected */}
                    {selected.kind === 'station' && selected.id === st.id && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700">
                        {hardwareCatalog.slice(0, 6).map(hw => (
                          <button
                            key={hw.id}
                            className="text-[9px] bg-slate-700 hover:bg-slate-600 rounded px-1.5 py-0.5 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            onClick={e => { e.stopPropagation(); addHardwareToStation(st.id, hw.id); }}
                            aria-label={`Add ${hw.name} to station`}
                          >
                            +{hw.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resizer */}
                  <div
                    className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-emerald-500 rounded-tl-md"
                    onMouseDown={e => resizeStart(e, st.id)}
                  />
                </div>
              ))}

              {/* Labels */}
              {currentFloor?.labels.map(l => (
                <div
                  key={l.id}
                  className={`absolute select-none px-2 py-1 rounded border cursor-move ${selected.kind === 'label' && selected.id === l.id ? 'border-emerald-400' : 'border-slate-600'} bg-slate-800/80 text-xs text-white`}
                  style={{ left: l.x, top: l.y, transform: `rotate(${l.rot}deg)` }}
                  onMouseDown={e => { e.stopPropagation(); dragStart(e, 'label', l.id); }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="bg-transparent outline-none text-xs w-20 text-white focus:ring-2 focus:ring-amber-500"
                      value={l.text}
                      onChange={e => updateLabel(l.id, { text: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      aria-label="Label text"
                    />
                    <button className="text-slate-200 hover:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={e => { e.stopPropagation(); updateLabel(l.id, { rot: (l.rot + 15) % 360 }); }} aria-label="Rotate label">
                      <RotateCw size={10} />
                    </button>
                    <button className="text-red-400 focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={e => { e.stopPropagation(); removeLabel(l.id); }} aria-label="Delete label">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Cable runs */}
              {currentFloor?.layers.filter(l => l.type === 'network' && l.visible).flatMap(layer =>
                layer.cableRuns.map(run => {
                  const dx = run.to.x - run.from.x;
                  const dy = run.to.y - run.from.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                  return (
                    <div key={run.id} className="absolute" style={{ left: run.from.x, top: run.from.y, width: len, transform: `rotate(${angle}deg)`, transformOrigin: '0 0' }}>
                      <div className="border-t-2 border-dotted border-cyan-400" />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-600 text-white whitespace-nowrap">
                        {run.lengthFt} ft - {run.ttiMin} min
                      </div>
                      <button
                        className="absolute -bottom-5 right-0 text-[10px] text-red-400 bg-slate-900/80 px-1 rounded border border-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        onClick={e => { e.stopPropagation(); removeCable(layer.id, run.id); }}
                        aria-label="Remove cable run"
                      >
                        remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pan hint */}
          <div className="absolute left-4 bottom-4 text-xs bg-slate-800/90 rounded-lg px-3 py-2 border border-slate-600 text-slate-300">
            <span className="text-slate-400">Hold</span> Space <span className="text-slate-400">+ drag to pan • Scroll to zoom</span>
          </div>

          {/* Scale chip */}
          <div className="absolute right-4 bottom-4 text-xs bg-slate-800/90 rounded-full px-3 py-1 border border-slate-600 text-white">
            1 ft = {currentFloor?.scalePxPerFt || 16} px
          </div>
        </div>

        {/* Right Sidebar */}
        <aside
          className={`flex-shrink-0 border-l border-slate-700 bg-slate-900/95 flex flex-col transition-all duration-300 ease-in-out ${rightOpen ? 'w-80' : 'w-0'}`}
          style={{ overflow: rightOpen ? 'visible' : 'hidden' }}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ display: rightOpen ? 'block' : 'none' }}>
            {/* Integrations Panel */}
            <CollapsiblePanel
              title="Integrations"
              icon={<Cable size={14} />}
              isOpen={rightPanels.integrations}
              onToggle={() => toggleRightPanel('integrations')}
              badge={currentLocation?.integrationIds.length || 0}
              maxHeight="220px"
            >
              <div className="space-y-1.5">
                {integrations.map(integ => (
                  <label key={integ.id} className="flex items-center justify-between gap-2 text-sm border border-slate-600 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors">
                    <div>
                      <div className="font-medium text-white text-xs">{integ.name}</div>
                      <div className="text-[10px] text-slate-400">{integ.ttiMin}m</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentLocation?.integrationIds.includes(integ.id) || false}
                      onChange={() => toggleIntegration(integ.id)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </CollapsiblePanel>

            {/* Travel & Support Panel */}
            <CollapsiblePanel
              title="Travel & Support"
              icon={<MapPin size={14} />}
              isOpen={rightPanels.travel}
              onToggle={() => toggleRightPanel('travel')}
              maxHeight="350px"
            >
              <div className="space-y-4">
                {/* Travel Zone */}
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Travel Zone</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
                    value={currentLocation?.travel?.zone || 'cape'}
                    onChange={e => updateCurrentLocation(loc => {
                      loc.travel = { ...loc.travel, zone: e.target.value as TravelSettings['zone'] };
                      return loc;
                    })}
                    disabled={currentLocation?.travel?.remote}
                  >
                    {Object.entries(TRAVEL_ZONE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Travel Options */}
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-white bg-slate-700/50 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={!!currentLocation?.travel?.remote}
                      onChange={e => updateCurrentLocation(loc => {
                        loc.travel = { ...loc.travel, remote: e.target.checked };
                        return loc;
                      })}
                      className="accent-emerald-500"
                    />
                    Remote Only
                  </label>
                  {currentLocation?.travel?.zone === 'island' && !currentLocation?.travel?.remote && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-white bg-slate-700/50 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-700">
                        <input
                          type="checkbox"
                          checked={!!currentLocation?.travel?.islandVehicle}
                          onChange={e => updateCurrentLocation(loc => {
                            loc.travel = { ...loc.travel, islandVehicle: e.target.checked };
                            return loc;
                          })}
                          className="accent-emerald-500"
                        />
                        Vehicle Ferry
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-white bg-slate-700/50 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-700">
                        <input
                          type="checkbox"
                          checked={!!currentLocation?.travel?.lodging}
                          onChange={e => updateCurrentLocation(loc => {
                            loc.travel = { ...loc.travel, lodging: e.target.checked };
                            return loc;
                          })}
                          className="accent-emerald-500"
                        />
                        Lodging
                      </label>
                    </>
                  )}
                </div>

                {/* Support Tiers */}
                <div className="pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Support Plan</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SUPPORT_TIERS.map(pct => (
                      <button
                        key={pct}
                        className={`py-1.5 text-center rounded-lg border text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors ${supportTier === pct ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300' : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'}`}
                        onClick={() => setSupportTier(pct)}
                      >
                        {pct === 0 ? 'None' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-white cursor-pointer">
                      <input
                        type="radio"
                        name="period"
                        checked={supportPeriod === 'monthly'}
                        onChange={() => setSupportPeriod('monthly')}
                        className="accent-emerald-500"
                      />
                      Monthly
                    </label>
                    <label className="flex items-center gap-1.5 text-white cursor-pointer">
                      <input
                        type="radio"
                        name="period"
                        checked={supportPeriod === 'annual'}
                        onChange={() => setSupportPeriod('annual')}
                        className="accent-emerald-500"
                      />
                      Annual
                    </label>
                  </div>
                </div>
              </div>
            </CollapsiblePanel>

            {/* Quote Summary Panel */}
            <CollapsiblePanel
              title="Quote Summary"
              icon={<Download size={14} />}
              isOpen={rightPanels.summary}
              onToggle={() => toggleRightPanel('summary')}
              badge={quoteLoading ? '...' : `$${Math.round(estimate.combinedFirst)}`}
              maxHeight="400px"
            >
              <div className="space-y-3">
                <div className="space-y-1.5 text-xs">
                  <SummaryRow label="Hardware labor" dollars={serverQuote?.summary.hardwareCost || 0} />
                  <SummaryRow label="Station overhead" dollars={serverQuote?.summary.overheadCost || 0} />
                  <SummaryRow label="Integrations" dollars={serverQuote?.summary.integrationsCost || 0} />
                  <SummaryRow label="Networking & cabling" dollars={serverQuote?.summary.cablingCost || 0} />
                  <SummaryRow label="Travel" dollars={estimate.travelCost} />
                  <div className="h-px bg-slate-700 my-2" />
                  <SummaryRow
                    label="Est. install time"
                    raw={serverQuote?.timeEstimate ? `${serverQuote.timeEstimate.minHours}-${serverQuote.timeEstimate.maxHours} hrs` : '--'}
                  />
                  <SummaryRow label="Install cost" dollars={estimate.installCost} />
                  <SummaryRow
                    label={`Support (${supportPeriod === 'monthly' ? 'Mo' : 'Yr'})`}
                    dollars={supportPeriod === 'monthly' ? estimate.supportMonthly : estimate.supportAnnual}
                  />
                  <div className="h-px bg-slate-700 my-2" />
                  <SummaryRow label="Install + Travel" dollars={estimate.installCost + estimate.travelCost} strong />
                  <SummaryRow
                    label={`Total (first ${supportPeriod === 'monthly' ? 'mo' : 'yr'})`}
                    dollars={estimate.combinedFirst}
                    strong
                  />
                </div>

                <div className="pt-3 border-t border-slate-700 space-y-2">
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <Mail size={14} /> Email Quote
                  </button>
                  <button
                    onClick={exportJSON}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <Download size={14} /> Export JSON
                  </button>
                </div>
              </div>
            </CollapsiblePanel>
          </div>
        </aside>
      </div>

      {/* Bottom Toolbar - Compact */}
      <footer className="flex-shrink-0 border-t border-slate-700 bg-slate-900/95 backdrop-blur z-20">
        <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto">
          {/* Layer controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Layers size={12} className="text-slate-400" />
            <select
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              value={activeLayerId}
              onChange={e => setActiveLayerId(e.target.value)}
            >
              {currentFloor?.layers.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button onClick={addLayer} className="bg-slate-700 hover:bg-slate-600 rounded p-1 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Layer">
              <Plus size={12} />
            </button>
          </div>

          <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />

          {/* Layer visibility toggles */}
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            {currentFloor?.layers.map(l => (
              <label key={l.id} className="flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => toggleLayerVisibility(l.id)}
                  className="accent-emerald-500 w-3 h-3"
                />
                <span className="text-[11px]">{l.name}</span>
              </label>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />

          {/* Cable run button */}
          {activeLayer?.type === 'network' && (
            <button
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors flex-shrink-0 ${mode === 'addCable' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`}
              onClick={() => {
                setMode(mode === 'addCable' ? 'idle' : 'addCable');
                setPendingCableStart(null);
              }}
            >
              <Cable size={12} />
              {mode === 'addCable' ? 'Click map...' : 'Cable'}
            </button>
          )}

          {/* Scale control */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-slate-400">Scale</span>
            <input
              type="number"
              className="bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white w-12"
              value={currentFloor?.scalePxPerFt || 16}
              onChange={e => updateCurrentLocation(loc => {
                const f = loc.floors.find(fl => fl.id === currentFloor?.id);
                if (f) f.scalePxPerFt = Math.max(4, Number(e.target.value) || 16);
                return loc;
              })}
            />
            <span className="text-[10px] text-slate-400">px/ft</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom controls in footer */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))}
              className="p-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] text-slate-300 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}
              className="p-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => { setZoom(1); resetPan(); }}
              className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Reset view"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />

          {/* Reset button */}
          <button
            onClick={resetFloor}
            className="px-2 py-1 text-xs bg-red-900/50 border border-red-700 hover:bg-red-800/50 rounded text-red-300 flex-shrink-0 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
          >
            Reset
          </button>
        </div>
      </footer>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-600">
            {emailStatus.type === 'success' ? (
              // Success state
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Quote Sent!</h3>
                <p className="text-slate-300 mb-6">{emailStatus.message}</p>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailStatus({ type: 'idle', message: '' });
                    setEmailForm({ name: '', email: '', restaurantName: '', phone: '' });
                  }}
                  className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  Close
                </button>
              </div>
            ) : (
              // Form state
              <>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Save Your Quote</h3>
                <p className="text-slate-200 mb-4 text-sm">Enter your details and we'll send you this itemized breakdown immediately.</p>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setEmailSending(true);
                    setEmailStatus({ type: 'idle', message: '' });

                    try {
                      const response = await fetch('/api/quote/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: emailForm.name,
                          email: emailForm.email,
                          restaurantName: emailForm.restaurantName,
                          phone: emailForm.phone,
                          quoteData: serverQuote,
                          locations: locations,
                          estimate: estimate
                        })
                      });

                      const result = await response.json();

                      if (result.success) {
                        setEmailStatus({
                          type: 'success',
                          message: result.message || "We'll be in touch within 24 hours!"
                        });
                      } else {
                        setEmailStatus({
                          type: 'error',
                          message: result.error || 'Failed to send quote request'
                        });
                      }
                    } catch (error) {
                      console.error('Email send error:', error);
                      setEmailStatus({
                        type: 'error',
                        message: 'Connection error. Please try again.'
                      });
                    } finally {
                      setEmailSending(false);
                    }
                  }}
                >
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Name *</label>
                    <input
                      type="text"
                      value={emailForm.name}
                      onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                      disabled={emailSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Email *</label>
                    <input
                      type="email"
                      value={emailForm.email}
                      onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                      disabled={emailSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Restaurant Name</label>
                    <input
                      type="text"
                      value={emailForm.restaurantName}
                      onChange={(e) => setEmailForm({ ...emailForm, restaurantName: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      disabled={emailSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Phone</label>
                    <input
                      type="tel"
                      value={emailForm.phone}
                      onChange={(e) => setEmailForm({ ...emailForm, phone: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      placeholder="(optional)"
                      disabled={emailSending}
                    />
                  </div>

                  {/* Error message */}
                  {emailStatus.type === 'error' && (
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                      {emailStatus.message}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailModal(false);
                        setEmailStatus({ type: 'idle', message: '' });
                      }}
                      className="flex-1 py-2 text-slate-200 hover:bg-slate-700 rounded-lg border border-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      disabled={emailSending}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-brand-accent text-white rounded-lg hover:bg-amber-600 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      disabled={emailSending}
                    >
                      {emailSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Quote'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import PDF Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Import Toast PDF
              </h3>
              <button
                onClick={resetImportModal}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {importStatus === 'idle' && (
              <>
                <p className="text-slate-300 text-sm mb-4">
                  Upload a Toast quote or order PDF to automatically extract hardware items.
                </p>
                <div
                  className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer"
                  onClick={() => importFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-purple-500', 'bg-purple-500/10'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-purple-500', 'bg-purple-500/10'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-500/10');
                    const file = e.dataTransfer.files[0];
                    if (file) handleImportPdf(file);
                  }}
                >
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">Drop PDF here or click to browse</p>
                  <p className="text-slate-400 text-xs">Accepts Toast quote PDFs (max 10MB)</p>
                </div>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportPdf(file);
                  }}
                />
              </>
            )}

            {(importStatus === 'uploading' || importStatus === 'processing') && (
              <div className="py-8 text-center">
                <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-spin" />
                <p className="text-white font-medium">
                  {importStatus === 'uploading' ? 'Uploading PDF...' : 'Extracting hardware items...'}
                </p>
                <p className="text-slate-400 text-sm mt-1">This may take a few seconds</p>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="py-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Import Failed</p>
                <p className="text-red-300 text-sm mb-4">{importError}</p>
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Try Again
                </button>
              </div>
            )}

            {importStatus === 'complete' && (
              <>
                <div className="flex items-center gap-2 text-green-400 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Extracted {extractedItems.length} items</span>
                </div>

                {/* Preview extracted items */}
                <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
                  {extractedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-slate-400 text-xs">
                          {item.mappedHardwareIds.length > 0
                            ? `Maps to: ${item.mappedHardwareIds.join(', ')}`
                            : 'Unknown hardware type'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-purple-400 font-medium text-sm">×{item.quantity}</span>
                        <span className={`w-2 h-2 rounded-full ${item.confidence > 0.7 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      </div>
                    </div>
                  ))}
                  {extractedItems.length === 0 && (
                    <p className="text-slate-400 text-center py-4">No hardware items found in the PDF</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetImportModal}
                    className="flex-1 py-2 text-slate-200 hover:bg-slate-700 rounded-lg border border-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importExtractedHardware}
                    disabled={extractedItems.length === 0}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import to Builder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// SUBCOMPONENTS
// ============================================

interface SummaryRowProps {
  label: string;
  dollars?: number;
  minutes?: number;
  rate?: number;
  raw?: string;
  strong?: boolean;
}

function SummaryRow({ label, dollars, minutes, rate, raw, strong }: SummaryRowProps) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      <span className="text-white">{label}</span>
      <span className="tabular-nums text-right text-white">
        {raw ? raw : (
          dollars != null ? `$${Number(dollars || 0).toFixed(2)}` :
            `${minutes || 0} min${rate ? ` @ $${rate}/hr` : ''}`
        )}
      </span>
    </div>
  );
}

export default QuoteBuilder;
