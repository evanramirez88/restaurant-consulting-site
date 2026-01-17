import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { extractText, getDocumentProxy } from 'unpdf';
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
  Crosshair,
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
  CheckCircle,
  Wifi,
  Globe,
  AlertTriangle
} from 'lucide-react';

// ============================================
// COMING SOON FLAG - Set to false when ready to launch
// This is the local fallback. The API flag takes precedence.
// ============================================
const SHOW_COMING_SOON = false;
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
  ServiceMode,
  ExtractedHardware,
  ImportStatus,
  StationGroup,
  ExtractedClientInfo,
  ExtractedSoftware,
  ExtractedAdminData,
  ParseTextResponse,
  HardwareGroup
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
  TRAVEL_ZONE_LABELS,
  GO_LIVE_SUPPORT_OPTIONS,
  SERVICE_MODE_LABELS,
  ZONE_RECOMMENDED_MODE,
  ZONES_REQUIRING_TRAVEL_DISCUSSION
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
    travel: {
      zone: "cape",
      serviceMode: "onsite", // Default to on-site for Cape Cod
      islandVehicle: false,
      lodging: false,
      remote: false,
      travelDiscussionRequired: false
    },
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

  let zone: TravelSettings['zone'] = "outOfRegion";

  if (isNantucket || isMV) {
    zone = "island";
  } else if (isCape) {
    zone = "cape";
  } else {
    const south = ["plymouth", "kingston", "duxbury", "marshfield", "scituate", "hingham", "quincy", "weymouth", "braintree", "norwell", "hanover", "cohasset"];
    if (south.some(t => a.includes(t))) {
      zone = "southShore";
    } else {
      const ne = ["connecticut", "rhode", "new hampshire", "vermont", "maine", "massachusetts"];
      if (ne.some(t => a.includes(t))) {
        zone = "southernNE";
      }
    }
  }

  // Get recommended service mode for this zone
  const serviceMode = ZONE_RECOMMENDED_MODE[zone] || 'remote';

  return {
    zone,
    serviceMode,
    travelDiscussionRequired: false // Will be set if user overrides to on-site for distant zones
  };
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
  <div className="overflow-hidden transition-all duration-200">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800/40 rounded-lg transition-colors text-left group"
    >
      <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
        <ChevronRight size={14} className="text-gray-500 group-hover:text-amber-400" />
      </span>
      {icon && <span className="text-gray-400 group-hover:text-amber-400 transition-colors">{icon}</span>}
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex-1">{title}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-medium">{badge}</span>
      )}
    </button>
    <div
      className="transition-all duration-200 ease-in-out"
      style={{
        maxHeight: isOpen ? maxHeight : '0px',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden'
      }}
    >
      <div className="pl-7 pr-2 pb-3 pt-1 overflow-y-auto quote-builder-scrollbar" style={{ maxHeight: `calc(${maxHeight} - 16px)` }}>
        {children}
      </div>
    </div>
    {/* Subtle divider line when open */}
    {isOpen && <div className="mx-3 border-b border-gray-700/50" />}
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
  // Demo mode (?demo=true) bypasses the check for demonstrations
  // Feature flag controls access for all users including admins
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // Check if demo mode is enabled via URL parameter
        // Support both ?demo=true and #/path?demo=true (hash routing)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

        // Demo mode bypasses feature flag for demonstrations
        if (isDemoMode) {
          setIsFeatureEnabled(true);
          setFeatureFlagLoading(false);
          return;
        }

        // Check feature flag from API (controls access for everyone including admins)
        const response = await fetch('/api/admin/feature-flags');
        const result = await response.json();
        if (result.success && result.data?.flags) {
          setIsFeatureEnabled(result.data.flags.quote_builder_enabled === true);
        } else {
          // API failed, fall back to local constant
          setIsFeatureEnabled(!SHOW_COMING_SOON);
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
  const [hardwareGroups, setHardwareGroups] = usePersistentState<HardwareGroup[]>(LS_KEY + ":hardwareGroups", []);

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

  // Onboarding state
  const [hasStarted, setHasStarted] = usePersistentState<boolean>(LS_KEY + ":hasStarted", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding for new users
  useEffect(() => {
    if (!hasStarted) {
      setShowOnboarding(true);
    }
  }, [hasStarted]);

  // Client Intelligence state
  const [linkedLeadId, setLinkedLeadId] = usePersistentState<string | null>(LS_KEY + ":linkedLeadId", null);
  const [linkedClientId, setLinkedClientId] = usePersistentState<string | null>(LS_KEY + ":linkedClientId", null);
  const [intelligenceData, setIntelligenceData] = useState<{
    source: string;
    confidence: number;
    name?: string;
    address?: string;
    service_style?: string;
    cuisine_type?: string;
    bar_program?: string;
    menu_complexity?: string;
    pos_system?: string;
    seating_capacity?: number;
  } | null>(null);
  const [showLeadSearch, setShowLeadSearch] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<Array<{
    id: string;
    type: 'client' | 'lead';
    name: string;
    contact?: string;
    email?: string;
    address?: string;
    service_style?: string;
    cuisine_type?: string;
    pos_system?: string;
    score?: number;
  }>>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);

  // PDF Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedHardware[]>([]);
  const [stationGroups, setStationGroups] = useState<StationGroup[]>([]);
  const [ungroupedItems, setUngroupedItems] = useState<ExtractedHardware[]>([]);
  const [extractedClientInfo, setExtractedClientInfo] = useState<ExtractedClientInfo | null>(null);
  const [extractedSoftware, setExtractedSoftware] = useState<ExtractedSoftware[]>([]);
  const [extractedAdminData, setExtractedAdminData] = useState<ExtractedAdminData | null>(null);
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
    setStationGroups([]);
    setUngroupedItems([]);
    setExtractedClientInfo(null);
    setExtractedSoftware([]);
    setExtractedAdminData(null);

    try {
      // Read PDF and extract text using unpdf
      console.log('[PDF Import] Starting import for:', file.name, 'Size:', file.size);
      const arrayBuffer = await file.arrayBuffer();
      console.log('[PDF Import] ArrayBuffer size:', arrayBuffer.byteLength);

      setImportStatus('processing');

      // Create document proxy and extract text with pages merged
      console.log('[PDF Import] Creating document proxy...');
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      console.log('[PDF Import] Document proxy created, numPages:', pdf.numPages);

      console.log('[PDF Import] Extracting text with mergePages: true...');
      const result = await extractText(pdf, { mergePages: true });
      console.log('[PDF Import] extractText result:', typeof result, 'keys:', Object.keys(result));

      const { totalPages, text: fullText } = result;
      console.log('[PDF Import] totalPages:', totalPages, 'text type:', typeof fullText, 'text length:', fullText?.length);

      // Validate extraction result
      if (!fullText || typeof fullText !== 'string' || fullText.trim().length === 0) {
        throw new Error('Could not extract text from PDF. The file may be scanned/image-based or corrupted.');
      }

      // Send extracted text to API for parsing
      const parseRes = await fetch('/api/quote/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          fileName: file.name
        })
      });

      const parseData: ParseTextResponse = await parseRes.json();
      if (!parseData.success) {
        throw new Error(parseData.error || 'Parsing failed');
      }

      // Store all extracted data
      setExtractedItems(parseData.extractedItems || []);
      setStationGroups(parseData.stationGroups || []);
      setUngroupedItems(parseData.ungroupedItems || []);
      setExtractedClientInfo(parseData.clientInfo || null);
      setExtractedSoftware(parseData.software || []);
      setExtractedAdminData(parseData.adminData || null);

      // If client info has a business name, update the location name
      if (parseData.clientInfo?.businessName) {
        updateCurrentLocation(loc => ({
          ...loc,
          name: parseData.clientInfo.businessName || loc.name,
          address: parseData.clientInfo.address
            ? `${parseData.clientInfo.address}${parseData.clientInfo.city ? ', ' + parseData.clientInfo.city : ''}${parseData.clientInfo.state ? ' ' + parseData.clientInfo.state : ''}${parseData.clientInfo.zip ? ' ' + parseData.clientInfo.zip : ''}`
            : loc.address
        }));
      }

      // Auto-enable detected software integrations
      if (parseData.software && parseData.software.length > 0) {
        updateCurrentLocation(loc => ({
          ...loc,
          integrationIds: [
            ...new Set([...loc.integrationIds, ...parseData.software.map(s => s.id)])
          ]
        }));
      }

      console.log('[PDF Import] Extracted:', {
        stationGroups: parseData.stationGroups?.length || 0,
        ungroupedItems: parseData.ungroupedItems?.length || 0,
        software: parseData.software?.length || 0,
        hasClientInfo: !!parseData.clientInfo?.businessName
      });

      setImportStatus('complete');

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
      setImportStatus('error');
    }
  };

  const importExtractedHardware = () => {
    const hasGroupedItems = stationGroups.length > 0;
    const hasUngroupedItems = ungroupedItems.length > 0;

    if (!hasGroupedItems && !hasUngroupedItems && extractedItems.length === 0) return;

    const newStations: AdvancedStation[] = [];
    const stationColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    let colorIndex = 0;
    let xOffset = 100;
    let yOffset = 100;

    // Create stations from station groups
    for (const group of stationGroups) {
      // Create multiple stations if group.quantity > 1
      for (let stationNum = 0; stationNum < group.quantity; stationNum++) {
        const station: AdvancedStation = {
          id: uid(),
          name: group.quantity > 1 ? `${group.name} ${stationNum + 1}` : group.name,
          type: group.name,
          color: stationColors[colorIndex % stationColors.length],
          x: xOffset,
          y: yOffset,
          w: 280,
          h: 180,
          nickname: '',
          notes: `Imported from Toast PDF - ${new Date().toLocaleDateString()}`,
          dept: group.name.toLowerCase().includes('kitchen') || group.name.toLowerCase().includes('expo') ? 'BOH' : 'FOH',
          flags: { existing: false, replace: false },
          hardware: []
        };

        // Add hardware items to this station
        for (const item of group.items) {
          for (let i = 0; i < item.quantity; i++) {
            for (const hid of item.mappedHardwareIds) {
              station.hardware.push({
                hid,
                nickname: '',
                notes: '',
                flags: { existing: false, replace: false }
              });
            }
          }
        }

        newStations.push(station);

        // Offset next station position
        xOffset += 320;
        if (xOffset > 900) {
          xOffset = 100;
          yOffset += 220;
        }
      }
      colorIndex++;
    }

    // Create a station for ungrouped items
    if (hasUngroupedItems || (extractedItems.length > 0 && !hasGroupedItems)) {
      const itemsToUse = hasUngroupedItems ? ungroupedItems : extractedItems;
      const ungroupedStation: AdvancedStation = {
        id: uid(),
        name: 'Imported Hardware',
        type: 'Imported',
        color: '#6b7280', // Gray for ungrouped
        x: xOffset,
        y: yOffset,
        w: 300,
        h: 200,
        nickname: 'From Toast PDF',
        notes: `Imported ${new Date().toLocaleDateString()} - Review and organize into stations`,
        dept: 'FOH',
        flags: { existing: false, replace: false },
        hardware: []
      };

      for (const item of itemsToUse) {
        for (let i = 0; i < item.quantity; i++) {
          for (const hid of item.mappedHardwareIds) {
            ungroupedStation.hardware.push({
              hid,
              nickname: item.productName.substring(0, 30),
              notes: '',
              flags: { existing: false, replace: false }
            });
          }
        }
      }

      if (ungroupedStation.hardware.length > 0) {
        newStations.push(ungroupedStation);
      }
    }

    // Add all new stations to current floor
    updateCurrentLocation(loc => {
      const floor = loc.floors.find(f => f.id === currentFloor?.id);
      if (floor) {
        floor.stations.push(...newStations);
      }
      return loc;
    });

    // Select the first new station
    if (newStations.length > 0) {
      setSelected({ kind: 'station', id: newStations[0].id });
    }

    // Close modal and reset all state
    resetImportModal();
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setExtractedItems([]);
    setStationGroups([]);
    setUngroupedItems([]);
    setExtractedClientInfo(null);
    setExtractedSoftware([]);
    setExtractedAdminData(null);
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
        // Note: Networking area is now fully removable - users can add it back from templates if needed
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

  // Hardware Group operations
  const createHardwareGroup = (name: string, hardwareIds: string[]) => {
    const group: HardwareGroup = {
      id: uid(),
      name,
      color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'][hardwareGroups.length % 6],
      hardwareIds,
      collapsed: false
    };
    setHardwareGroups(prev => [...prev, group]);
    return group.id;
  };

  const updateHardwareGroup = (groupId: string, patch: Partial<HardwareGroup>) => {
    setHardwareGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...patch } : g));
  };

  const deleteHardwareGroup = (groupId: string) => {
    setHardwareGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addHardwareToGroup = (groupId: string, hid: string) => {
    setHardwareGroups(prev => prev.map(g =>
      g.id === groupId && !g.hardwareIds.includes(hid)
        ? { ...g, hardwareIds: [...g.hardwareIds, hid] }
        : g
    ));
  };

  const removeHardwareFromGroup = (groupId: string, hid: string) => {
    setHardwareGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, hardwareIds: g.hardwareIds.filter(id => id !== hid) }
        : g
    ));
  };

  const addGroupToStation = (stationId: string, groupId: string) => {
    const group = hardwareGroups.find(g => g.id === groupId);
    if (!group) return;
    const st = currentFloor?.stations.find(s => s.id === stationId);
    if (!st) return;

    const newHardware = group.hardwareIds.map(hid => ({
      hid,
      nickname: "",
      notes: "",
      flags: { existing: false, replace: false },
      groupId
    }));

    updateStation(stationId, {
      hardware: [...st.hardware, ...newHardware]
    });
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
      // Only auto-classify if not locked to remote mode
      if (loc.travel.serviceMode !== 'remote') {
        const classification = classifyAddress(addr);
        loc.travel = {
          ...loc.travel,
          ...classification,
          // Sync legacy remote flag with serviceMode
          remote: classification.serviceMode === 'remote'
        };
      }
      return loc;
    });
  };

  // Service Mode setter with travel discussion logic
  const setServiceMode = (mode: ServiceMode) => {
    updateCurrentLocation(loc => {
      const zone = loc.travel?.zone || 'cape';
      const requiresDiscussion = mode !== 'remote' && ZONES_REQUIRING_TRAVEL_DISCUSSION.includes(zone);

      loc.travel = {
        ...loc.travel,
        serviceMode: mode,
        remote: mode === 'remote',
        travelDiscussionRequired: requiresDiscussion
      };
      return loc;
    });
  };

  // Client Intelligence - Lead/Client Search
  const searchLeads = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setLeadSearchResults([]);
      return;
    }

    setLeadSearchLoading(true);
    try {
      const response = await fetch(`/api/quote/search-leads?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      if (data.success) {
        setLeadSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('Lead search error:', e);
    } finally {
      setLeadSearchLoading(false);
    }
  }, []);

  // Debounced lead search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (showLeadSearch && leadSearchQuery) {
        searchLeads(leadSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [leadSearchQuery, showLeadSearch, searchLeads]);

  // Load intelligence data when a lead/client is selected
  const loadIntelligence = useCallback(async (item: typeof leadSearchResults[0]) => {
    // Store the linked ID
    if (item.type === 'client') {
      setLinkedClientId(item.id);
      setLinkedLeadId(null);
    } else {
      setLinkedLeadId(item.id);
      setLinkedClientId(null);
    }

    // Update current location with intelligence data
    updateCurrentLocation(loc => ({
      ...loc,
      name: item.name || loc.name,
      address: item.address || loc.address
    }));

    // Apply address classification if we have an address
    if (item.address) {
      setAddress(item.address);
    }

    // Store intelligence metadata
    setIntelligenceData({
      source: item.type,
      confidence: item.type === 'client' ? 0.9 : 0.6,
      name: item.name,
      address: item.address,
      service_style: item.service_style || undefined,
      cuisine_type: item.cuisine_type || undefined,
      pos_system: item.pos_system || undefined
    });

    // Close the search modal
    setShowLeadSearch(false);
    setLeadSearchQuery('');
    setLeadSearchResults([]);
  }, [setAddress, updateCurrentLocation]);

  // Clear intelligence link
  const clearIntelligenceLink = () => {
    setLinkedLeadId(null);
    setLinkedClientId(null);
    setIntelligenceData(null);
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
    // Alt+scroll for zoom (avoiding Ctrl which conflicts with browser zoom)
    // Also support pinch-to-zoom on trackpads (detected by ctrlKey being set during pinch)
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.1, Math.min(4, +(z + delta).toFixed(2))));
    } else if (e.ctrlKey && Math.abs(e.deltaY) < 50) {
      // Pinch-to-zoom on trackpad (smaller deltaY values)
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(z => Math.max(0.1, Math.min(4, +(z + delta).toFixed(2))));
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
      // Snap to 2px grid, no boundaries - canvas is infinite
      const nx = Math.round((startPos.x + dx) / 2) * 2;
      const ny = Math.round((startPos.y + dy) / 2) * 2;

      if (kind === 'station') updateStation(id, { x: nx, y: ny });
      if (kind === 'object') updateObject(id, { x: nx, y: ny });
      if (kind === 'label') updateLabel(id, { x: nx, y: ny });
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
    // Remote mode = no travel cost
    const isRemote = loc.travel?.serviceMode === 'remote' || loc.travel?.remote;
    if (isRemote) return 0;

    // Travel discussion required = travel TBD (return 0, will be quoted separately)
    if (loc.travel?.travelDiscussionRequired) return 0;

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
            supportPeriod,
            goLiveSupportEnabled: currentLocation.goLiveSupportEnabled,
            goLiveSupportDays: currentLocation.goLiveSupportDays,
            goLiveSupportDate: currentLocation.goLiveSupportDate
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
      goLiveSupportCost: 0,
      goLiveSupportDays: 0,
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
      goLiveSupportCost: serverQuote.summary.goLiveSupportCost || 0,
      goLiveSupportDays: serverQuote.summary.goLiveSupportDays || 0,
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

  // ============================================
  // RENDER
  // ============================================

  // Loading state while checking feature flag
  if (featureFlagLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Coming Soon overlay - shows when feature is disabled via API or local flag
  if (!isFeatureEnabled) {
    return (
      <div className="bg-primary-dark min-h-screen flex items-center justify-center relative hero-grain">
        {/* Full page centered content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">

          {/* Animated Preview Mockup */}
          <div className="hero-fade-in mb-12">
            <div className="quote-preview-container">
              {/* Floating animated mockup showing floor plan → quote */}
              <div className="quote-preview-mockup">
                {/* Left side - "floor plan" being analyzed */}
                <div className="floor-plan-doc">
                  <div className="floor-grid">
                    <div className="floor-station station-1"></div>
                    <div className="floor-station station-2"></div>
                    <div className="floor-station station-3"></div>
                    <div className="floor-cable cable-1"></div>
                    <div className="floor-cable cable-2"></div>
                  </div>
                  {/* Scanning animation */}
                  <div className="scan-overlay"></div>
                </div>

                {/* Arrow showing transformation */}
                <div className="transform-arrow-quote">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Right side - quote summary */}
                <div className="quote-summary">
                  <div className="quote-line quote-line-1">
                    <div className="line-label"></div>
                    <div className="line-value"></div>
                  </div>
                  <div className="quote-line quote-line-2">
                    <div className="line-label"></div>
                    <div className="line-value"></div>
                  </div>
                  <div className="quote-line quote-line-3">
                    <div className="line-label"></div>
                    <div className="line-value"></div>
                  </div>
                  <div className="quote-total">
                    <div className="total-label"></div>
                    <div className="total-value"></div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="preview-status-badge-quote">
                  <div className="status-dot-quote"></div>
                  <span>Calculating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="hero-fade-in hero-fade-in-delay-1 font-display text-5xl md:text-6xl font-bold text-amber-400 mb-4">
            Quote Builder
          </h1>

          {/* Subheadline */}
          <div className="hero-fade-in hero-fade-in-delay-1 mb-10">
            <p className="text-2xl md:text-3xl text-white font-display mb-3">
              Intelligent POS Quoting
            </p>
            <div className="brass-underline mx-auto"></div>
          </div>

          {/* Body Copy */}
          <div className="hero-fade-in hero-fade-in-delay-2 mb-12 max-w-2xl mx-auto">
            <p className="text-lg text-gray-300 leading-relaxed mb-6">
              Design your restaurant floor plan, place stations, and get instant accurate quotes
              for your Toast POS installation. Our DCI algorithm factors in complexity,
              hardware needs, and travel to deliver precise pricing.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-400 mt-8">
              <div className="flex items-center justify-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Floor Plan Mapping</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>DCI Algorithm</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Download className="w-4 h-4 text-amber-400" />
                <span>PDF Export</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="hero-fade-in hero-fade-in-delay-3 flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a
              href="https://cal.com/r-g-consulting"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all hover:opacity-90 shadow-lg"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              <Calendar size={20} />
              Schedule a Quote Consultation
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all hover:opacity-90 cta-secondary-dark"
            >
              Get Notified at Launch
            </Link>
          </div>

          {/* Back to Home Link */}
          <div className="hero-fade-in hero-fade-in-delay-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
              Back to Home
            </Link>
          </div>
        </div>

        {/* Inline styles for the preview mockup */}
        <style>{`
          .quote-preview-container {
            display: flex;
            justify-content: center;
            perspective: 1000px;
          }

          .quote-preview-mockup {
            position: relative;
            width: 360px;
            height: 200px;
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 1px solid #374151;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            animation: quote-float 6s ease-in-out infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 20px;
          }

          @keyframes quote-float {
            0%, 100% {
              transform: translateY(0) rotateX(5deg) rotateY(-3deg);
            }
            50% {
              transform: translateY(-12px) rotateX(5deg) rotateY(-3deg);
            }
          }

          .floor-plan-doc {
            width: 100px;
            height: 100px;
            background: #1a1f2e;
            border: 1px solid #374151;
            border-radius: 6px;
            position: relative;
            overflow: hidden;
          }

          .floor-grid {
            width: 100%;
            height: 100%;
            position: relative;
            padding: 8px;
          }

          .floor-station {
            position: absolute;
            background: linear-gradient(135deg, #ea580c, #f59e0b);
            border-radius: 3px;
          }

          .station-1 {
            width: 24px;
            height: 18px;
            top: 12px;
            left: 12px;
            animation: station-pulse 3s ease-in-out infinite;
          }

          .station-2 {
            width: 20px;
            height: 20px;
            top: 50%;
            right: 12px;
            transform: translateY(-50%);
            animation: station-pulse 3s ease-in-out infinite 0.5s;
          }

          .station-3 {
            width: 28px;
            height: 16px;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%);
            animation: station-pulse 3s ease-in-out infinite 1s;
          }

          @keyframes station-pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }

          .floor-cable {
            position: absolute;
            background: #3b82f6;
            opacity: 0.6;
          }

          .cable-1 {
            width: 2px;
            height: 30px;
            top: 30px;
            left: 23px;
            animation: cable-draw 2s ease-in-out infinite;
          }

          .cable-2 {
            width: 25px;
            height: 2px;
            top: 50%;
            left: 40px;
            animation: cable-draw 2s ease-in-out infinite 0.5s;
          }

          @keyframes cable-draw {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }

          .scan-overlay {
            position: absolute;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, transparent, #f59e0b, transparent);
            animation: scan-floor 2.5s ease-in-out infinite;
          }

          @keyframes scan-floor {
            0%, 100% {
              top: 0;
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              top: calc(100% - 3px);
              opacity: 0;
            }
          }

          .transform-arrow-quote {
            width: 32px;
            height: 32px;
            color: #f59e0b;
            animation: arrow-pulse-quote 2s ease-in-out infinite;
          }

          @keyframes arrow-pulse-quote {
            0%, 100% {
              transform: translateX(0);
              opacity: 0.5;
            }
            50% {
              transform: translateX(4px);
              opacity: 1;
            }
          }

          .quote-summary {
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 120px;
          }

          .quote-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 4px;
            animation: line-appear 2.5s ease-in-out infinite;
          }

          .quote-line-1 { animation-delay: 0.2s; }
          .quote-line-2 { animation-delay: 0.4s; }
          .quote-line-3 { animation-delay: 0.6s; }

          @keyframes line-appear {
            0%, 20% {
              opacity: 0.3;
              transform: translateX(-3px);
            }
            40%, 80% {
              opacity: 1;
              transform: translateX(0);
            }
            100% {
              opacity: 0.3;
              transform: translateX(-3px);
            }
          }

          .line-label {
            width: 40px;
            height: 5px;
            background: #6b7280;
            border-radius: 2px;
          }

          .line-value {
            width: 28px;
            height: 5px;
            background: #9ca3af;
            border-radius: 2px;
          }

          .quote-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 4px;
            margin-top: 4px;
            animation: total-glow 2s ease-in-out infinite;
          }

          @keyframes total-glow {
            0%, 100% {
              box-shadow: 0 0 0 rgba(245, 158, 11, 0);
            }
            50% {
              box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
            }
          }

          .total-label {
            width: 35px;
            height: 6px;
            background: #f59e0b;
            border-radius: 2px;
          }

          .total-value {
            width: 35px;
            height: 6px;
            background: #f59e0b;
            border-radius: 2px;
          }

          .preview-status-badge-quote {
            position: absolute;
            bottom: 10px;
            right: 10px;
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid #374151;
            border-radius: 20px;
            padding: 4px 10px;
            font-size: 10px;
            color: #9ca3af;
          }

          .status-dot-quote {
            width: 6px;
            height: 6px;
            background: #f59e0b;
            border-radius: 50%;
            animation: dot-pulse-quote 1s ease-in-out infinite;
          }

          @keyframes dot-pulse-quote {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.4;
            }
          }

          @media (min-width: 640px) {
            .quote-preview-mockup {
              width: 460px;
              height: 220px;
              gap: 24px;
            }

            .floor-plan-doc {
              width: 120px;
              height: 120px;
            }

            .quote-summary {
              width: 150px;
            }

            .quote-line {
              padding: 8px 10px;
            }
          }
        `}</style>
      </div>
    );
  }

  // Start fresh - resets everything
  const handleStartFresh = () => {
    // Reset to clean default state
    setLocations([createDefaultLocation()]);
    setHardwareGroups([]);
    setHasStarted(true);
    setShowOnboarding(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Start from import
  const handleStartWithImport = () => {
    setHasStarted(true);
    setShowOnboarding(false);
    setShowImportModal(true);
  };

  // Start from lead search (intelligence)
  const handleStartWithIntelligence = () => {
    setHasStarted(true);
    setShowOnboarding(false);
    setShowLeadSearch(true);
  };

  // Continue with existing
  const handleContinueExisting = () => {
    setShowOnboarding(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1a] flex flex-col overflow-hidden quote-builder-theme">
      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-gray-700">
            {/* Logo/Title */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Building2 size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-serif text-white mb-2">Quote Builder</h2>
              <p className="text-gray-400">Create professional quotes for your restaurant POS installation</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <button
                onClick={handleStartFresh}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                  <Plus size={24} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Start Fresh</div>
                  <div className="text-sm text-gray-400">Create a new quote from scratch</div>
                </div>
              </button>

              <button
                onClick={handleStartWithImport}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition-colors">
                  <Upload size={24} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Import Toast Quote</div>
                  <div className="text-sm text-gray-400">Upload a PDF from Toast to pre-fill hardware</div>
                </div>
              </button>

              <button
                onClick={handleStartWithIntelligence}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <MapPin size={24} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-white font-medium">Search Existing Lead</div>
                  <div className="text-sm text-gray-400">Find a client or prospect to pre-populate data</div>
                </div>
              </button>

              {hasStarted && (
                <button
                  onClick={handleContinueExisting}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-700/30 border border-gray-600 hover:bg-gray-700/50 transition-colors text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-600 transition-colors">
                    <RefreshCw size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Continue Previous Quote</div>
                    <div className="text-sm text-gray-400">Resume where you left off</div>
                  </div>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-center text-xs text-gray-500">
                Your progress is saved automatically in your browser
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Toolbar - Compact */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-[#111827]/95 backdrop-blur z-20">
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {/* Back button and title */}
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-2 flex-shrink-0"
          >
            <X size={18} />
          </Link>
          <h1 className="text-white font-serif font-semibold text-sm mr-4 flex-shrink-0">Quote Builder</h1>

          <div className="w-px h-6 bg-gray-700 mx-1 flex-shrink-0" />

          {/* Location name with Intelligence Link */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Intelligence indicator */}
            {(linkedLeadId || linkedClientId) && intelligenceData ? (
              <button
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  linkedClientId ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
                onClick={() => setShowLeadSearch(true)}
                title={`Linked to ${linkedClientId ? 'client' : 'lead'}: ${intelligenceData.name}`}
              >
                <Building2 size={12} />
                <span className="max-w-24 truncate">{intelligenceData.name}</span>
                <X size={10} className="opacity-60 hover:opacity-100" onClick={e => { e.stopPropagation(); clearIntelligenceLink(); }} />
              </button>
            ) : (
              <button
                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                onClick={() => setShowLeadSearch(true)}
                title="Link to client or lead"
              >
                <Building2 size={12} />
                <span>Link Client</span>
              </button>
            )}
            <input
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white w-40"
              placeholder="Restaurant Name"
              value={currentLocation?.name || ''}
              onChange={e => updateCurrentLocation(loc => ({ ...loc, name: e.target.value }))}
              title="Edit restaurant name"
            />
            {locations.length > 1 && (
              <select
                className="bg-gray-800 border border-gray-700 rounded px-1 py-1.5 text-xs text-white w-8"
                value={locId}
                onChange={e => setLocId(e.target.value)}
                title="Switch location"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name || 'Unnamed'}</option>
                ))}
              </select>
            )}
            <button onClick={addLocation} className="bg-gray-700 hover:bg-gray-600 rounded p-1.5 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Location">
              <Plus size={12} />
            </button>
          </div>

          {/* Address input */}
          <input
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white w-48 flex-shrink-0"
            placeholder="Address (auto-detects zone)"
            value={currentLocation?.address || ''}
            onChange={e => setAddress(e.target.value)}
          />

          <div className="w-px h-6 bg-gray-700 mx-1 flex-shrink-0" />

          {/* Floor selector */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Layers size={14} className="text-gray-400" />
            <select
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
              value={floorId}
              onChange={e => setFloorId(e.target.value)}
            >
              {currentLocation?.floors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button onClick={addFloor} className="bg-gray-700 hover:bg-gray-600 rounded p-1.5 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Floor">
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
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${canUndo ? 'bg-gray-700 text-white hover:bg-gray-700' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${canRedo ? 'bg-gray-700 text-white hover:bg-gray-700' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
          </div>

          {/* New Quote & Import Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-gray-400 focus:outline-none"
              title="Start new quote"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none"
              title="Import Toast PDF"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>

          {/* Sidebar toggles */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${leftOpen ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
              title={leftOpen ? "Hide left panel" : "Show left panel"}
            >
              <PanelLeftClose size={14} />
            </button>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className={`p-1.5 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${rightOpen ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
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
          className={`flex-shrink-0 border-r border-gray-800 bg-[#111827]/95 flex flex-col transition-all duration-300 ease-in-out ${leftOpen ? 'w-72' : 'w-0'}`}
          style={{ overflow: leftOpen ? 'visible' : 'hidden' }}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-1 quote-builder-scrollbar" style={{ display: leftOpen ? 'block' : 'none' }}>
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
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  + Blank Station
                </button>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
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
                    className="w-full text-left px-3 py-2 border border-gray-700 rounded-lg hover:bg-gray-700/50 transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: t.color }}>{t.label}</span>
                      <span className="text-xs text-gray-400">{t.ttiMin}m</span>
                    </div>
                  </button>
                ))}
              </div>
            </CollapsiblePanel>

            {/* Hardware & Groups Panel */}
            <CollapsiblePanel
              title="Hardware & Groups"
              icon={<Wrench size={14} />}
              isOpen={leftPanels.hardware}
              onToggle={() => toggleLeftPanel('hardware')}
              badge={hardwareGroups.length > 0 ? hardwareGroups.length.toString() : undefined}
              maxHeight="400px"
            >
              <div className="space-y-3">
                {/* Hardware Groups Section */}
                {hardwareGroups.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <Layers size={12} />
                        Your Groups
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {hardwareGroups.map(group => (
                        <div
                          key={group.id}
                          className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/30"
                        >
                          {/* Group Header */}
                          <div
                            className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-gray-700/30"
                            onClick={() => updateHardwareGroup(group.id, { collapsed: !group.collapsed })}
                          >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
                            <input
                              className="bg-transparent text-sm font-medium text-white outline-none flex-1 min-w-0"
                              value={group.name}
                              onChange={e => { e.stopPropagation(); updateHardwareGroup(group.id, { name: e.target.value }); }}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-700 rounded">
                              {group.hardwareIds.length}
                            </span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${group.collapsed ? '-rotate-90' : ''}`} />
                          </div>

                          {/* Group Items & Actions */}
                          {!group.collapsed && (
                            <div className="px-2.5 pb-2 pt-1 border-t border-gray-700/50 space-y-2">
                              {/* Hardware chips */}
                              <div className="flex flex-wrap gap-1">
                                {group.hardwareIds.map(hid => {
                                  const hw = hwById[hid];
                                  if (!hw) return null;
                                  return (
                                    <div
                                      key={hid}
                                      className="group/item flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-700/50 text-gray-300"
                                    >
                                      <span className="truncate max-w-16">{hw.name}</span>
                                      <button
                                        className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-300"
                                        onClick={() => removeHardwareFromGroup(group.id, hid)}
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Group Actions */}
                              <div className="flex items-center gap-1 pt-1">
                                {selected.kind === 'station' && (
                                  <button
                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                    onClick={() => addGroupToStation(selected.id!, group.id)}
                                  >
                                    <Plus size={10} />
                                    Add to Station
                                  </button>
                                )}
                                <button
                                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                                  onClick={() => deleteHardwareGroup(group.id)}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create New Group */}
                <div className="border border-dashed border-gray-600 rounded-lg p-2">
                  <button
                    className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-emerald-400 py-1 transition-colors"
                    onClick={() => {
                      const name = `Group ${hardwareGroups.length + 1}`;
                      createHardwareGroup(name, []);
                    }}
                  >
                    <Plus size={12} />
                    Create New Group
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-700 pt-2">
                  <div className="text-xs text-gray-400 font-medium mb-2">All Hardware</div>
                </div>

                {/* Status indicator when station selected */}
                {selected.kind === 'station' && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/30">
                    Click to add to: <strong>{currentFloor?.stations.find(s => s.id === selected.id)?.name}</strong>
                  </div>
                )}

                {/* Hardware Items by Category */}
                {['POS', 'KDS', 'Printers', 'Network', 'Card', 'Power', 'Accessories'].map(category => {
                  const items = hardwareCatalog.filter(hw => hw.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{category}</div>
                      <div className="flex flex-wrap gap-1">
                        {items.map(hw => (
                          <button
                            key={hw.id}
                            onClick={() => {
                              if (selected.kind === 'station') {
                                addHardwareToStation(selected.id!, hw.id);
                              } else if (hardwareGroups.length > 0) {
                                // Add to most recent group if no station selected
                                addHardwareToGroup(hardwareGroups[hardwareGroups.length - 1].id, hw.id);
                              }
                            }}
                            className={`px-2 py-1 text-[11px] border rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                              selected.kind === 'station'
                                ? 'border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/15'
                                : hardwareGroups.length > 0
                                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15'
                                : 'border-gray-700 text-gray-400 opacity-50 cursor-not-allowed'
                            }`}
                            disabled={selected.kind !== 'station' && hardwareGroups.length === 0}
                            title={`${hw.name} - ${hw.ttiMin}m`}
                          >
                            {hw.name.split(' ').slice(0, 2).join(' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
                        className="px-2 py-1 text-xs border border-gray-700 rounded hover:bg-gray-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
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
                        className="px-2 py-1 text-xs border border-gray-700 rounded hover:bg-gray-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
                      >
                        {o.type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400 font-medium mb-1.5">Structure</div>
                  <div className="flex flex-wrap gap-1">
                    {STRUCTURE_OBJECTS.map(o => (
                      <button
                        key={o.type}
                        onClick={() => addObject(o)}
                        className="px-2 py-1 text-xs border border-gray-700 rounded hover:bg-gray-700/50 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
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

        {/* Canvas Area - Infinite Canvas with Fixed Rulers */}
        <div
          className="flex-1 relative overflow-hidden bg-[#050810]"
          onClick={() => !isPanning && setSelected({ kind: null, id: null })}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
        >
          {/* ═══════════════════════════════════════════════════════════════
              FIXED RULERS - Outside canvas, attached to viewport frame
              These stay fixed while content pans/zooms
              ═══════════════════════════════════════════════════════════════ */}

          {/* Horizontal Ruler - Fixed to top of viewport */}
          <div className="absolute top-0 left-7 right-0 h-7 bg-[#111827]/95 border-b border-gray-700/50 z-30 pointer-events-none overflow-hidden">
            {(() => {
              const pxPerFt = currentFloor?.scalePxPerFt || 16;
              const scaledPxPerFt = pxPerFt * zoom;
              // Calculate visible range in world feet - supports negative
              const startFt = Math.floor(-pan.x / scaledPxPerFt) - 5;
              const endFt = Math.ceil((window.innerWidth - pan.x) / scaledPxPerFt) + 10;
              const marks = [];
              for (let ft = startFt; ft <= endFt; ft++) {
                const isMajor = ft % 10 === 0;
                const isMid = ft % 5 === 0 && !isMajor;
                const screenX = (ft * pxPerFt * zoom) + pan.x;
                if (screenX < -30 || screenX > window.innerWidth + 30) continue;
                marks.push(
                  <div key={ft} className="absolute flex flex-col items-center" style={{ left: screenX }}>
                    <div
                      className={isMajor ? 'bg-amber-400/80' : isMid ? 'bg-gray-500' : 'bg-gray-600/50'}
                      style={{ width: 1, height: isMajor ? 12 : isMid ? 8 : 4 }}
                    />
                    {isMajor && (
                      <span className={`text-[8px] font-medium tabular-nums leading-none ${ft < 0 ? 'text-cyan-400' : 'text-amber-400/90'}`}>{ft}</span>
                    )}
                  </div>
                );
              }
              return marks;
            })()}
          </div>

          {/* Vertical Ruler - Fixed to left of viewport */}
          <div className="absolute top-7 left-0 bottom-0 w-7 bg-[#111827]/95 border-r border-gray-700/50 z-30 pointer-events-none overflow-hidden">
            {(() => {
              const pxPerFt = currentFloor?.scalePxPerFt || 16;
              const scaledPxPerFt = pxPerFt * zoom;
              // Calculate visible range in world feet - supports negative
              const startFt = Math.floor(-pan.y / scaledPxPerFt) - 5;
              const endFt = Math.ceil((window.innerHeight - pan.y) / scaledPxPerFt) + 10;
              const marks = [];
              for (let ft = startFt; ft <= endFt; ft++) {
                const isMajor = ft % 10 === 0;
                const isMid = ft % 5 === 0 && !isMajor;
                const screenY = (ft * pxPerFt * zoom) + pan.y;
                if (screenY < -30 || screenY > window.innerHeight + 30) continue;
                marks.push(
                  <div key={ft} className="absolute flex items-center" style={{ top: screenY }}>
                    <div
                      className={isMajor ? 'bg-amber-400/80' : isMid ? 'bg-gray-500' : 'bg-gray-600/50'}
                      style={{ height: 1, width: isMajor ? 12 : isMid ? 8 : 4 }}
                    />
                    {isMajor && (
                      <span className={`text-[8px] font-medium tabular-nums leading-none ml-0.5 ${ft < 0 ? 'text-cyan-400' : 'text-amber-400/90'}`}>{ft}</span>
                    )}
                  </div>
                );
              }
              return marks;
            })()}
          </div>

          {/* Origin Corner - Fixed */}
          <div className="absolute top-0 left-0 w-7 h-7 bg-[#0a0f1a] border-r border-b border-gray-700/50 flex items-center justify-center z-40">
            <button
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
              className="text-gray-500 hover:text-amber-400 transition-colors p-1"
              title="Reset view to origin (0,0)"
            >
              <Crosshair size={10} />
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              INFINITE GRID - CSS background that tiles infinitely
              Moves with pan, scales with zoom
              ═══════════════════════════════════════════════════════════════ */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              // Minor grid (1ft) + Major grid (10ft) - using neutral grays
              backgroundImage: `
                linear-gradient(to right, rgba(75, 85, 99, ${zoom > 0.5 ? 0.15 : 0.08}) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(75, 85, 99, ${zoom > 0.5 ? 0.15 : 0.08}) 1px, transparent 1px),
                linear-gradient(to right, rgba(156, 163, 175, 0.2) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(156, 163, 175, 0.2) 1px, transparent 1px)
              `,
              backgroundSize: `
                ${(currentFloor?.scalePxPerFt || 16) * zoom}px ${(currentFloor?.scalePxPerFt || 16) * zoom}px,
                ${(currentFloor?.scalePxPerFt || 16) * zoom}px ${(currentFloor?.scalePxPerFt || 16) * zoom}px,
                ${(currentFloor?.scalePxPerFt || 16) * 10 * zoom}px ${(currentFloor?.scalePxPerFt || 16) * 10 * zoom}px,
                ${(currentFloor?.scalePxPerFt || 16) * 10 * zoom}px ${(currentFloor?.scalePxPerFt || 16) * 10 * zoom}px
              `,
              backgroundPosition: `${pan.x}px ${pan.y}px`
            }}
          />

          {/* ═══════════════════════════════════════════════════════════════
              WORLD CONTENT LAYER - Infinite canvas for objects
              No size limits - objects can be placed anywhere
              ═══════════════════════════════════════════════════════════════ */}
          <div
            ref={canvasRef}
            className="absolute inset-0"
            onClick={canvasClick}
            style={{
              cursor: isPanning ? 'grab' : mode === 'addCable' ? 'crosshair' : 'default',
              userSelect: isPanning ? 'none' : 'auto'
            }}
          >
            {/* Transform layer - applies pan and zoom to world content */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
                // NO fixed size - truly infinite
              }}
            >

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
                    <button className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { w: o.w + 10 })} aria-label="Increase width">W+</button>
                    <button className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { w: Math.max(10, o.w - 10) })} aria-label="Decrease width">W-</button>
                    <button className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => updateObject(o.id, { rot: (o.rot + 15) % 360 })} aria-label="Rotate object"><RotateCw size={10} /></button>
                    <button className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-red-400 focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={() => removeObject(o.id)} aria-label="Delete object"><Trash2 size={10} /></button>
                  </div>
                  <div className="text-[10px] text-white/80 px-1">{o.type}</div>
                </div>
              ))}

              {/* Stations - Redesigned with cleaner cards */}
              {currentFloor?.stations.map(st => {
                const isSelected = selected.kind === 'station' && selected.id === st.id;
                const hwCount = st.hardware.length;
                const existingCount = st.hardware.filter(h => h.flags?.existing).length;
                const totalTti = st.hardware.reduce((sum, h) => {
                  const hw = hwById[h.hid];
                  return sum + (hw?.ttiMin || 0);
                }, 0);

                return (
                  <div
                    key={st.id}
                    className={`station-card absolute select-none rounded-lg border transition-all duration-150 ${isSelected ? 'border-emerald-400 shadow-lg shadow-emerald-500/20' : 'border-gray-700/60 hover:border-gray-600'} bg-gradient-to-b from-gray-800/95 to-gray-900/95 cursor-move group`}
                    style={{ left: st.x, top: st.y, width: st.w || 200, minHeight: isSelected ? 120 : 56 }}
                    onMouseDown={e => { e.stopPropagation(); dragStart(e, 'station', st.id); }}
                  >
                    {/* Floating action buttons - only visible on hover or selection */}
                    <div className={`absolute -top-2 -right-2 flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={e => e.stopPropagation()}>
                      <button
                        className="w-5 h-5 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                        onClick={() => {
                          const dupe = deepClone(st);
                          dupe.id = uid();
                          dupe.x += 24;
                          dupe.y += 24;
                          updateCurrentLocation(loc => {
                            const f = loc.floors.find(fl => fl.id === currentFloor?.id);
                            if (f) f.stations.push(dupe);
                            return loc;
                          });
                        }}
                        aria-label="Duplicate station"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        className="w-5 h-5 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-red-400 hover:text-red-300 hover:border-red-500/50 transition-colors"
                        onClick={() => removeStation(st.id)}
                        aria-label="Delete station"
                      >
                        <X size={10} />
                      </button>
                    </div>

                    {/* Compact Header */}
                    <div className="px-3 py-2 flex items-center gap-2">
                      {/* Color indicator */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/10"
                        style={{ background: st.color }}
                      />

                      {/* Name */}
                      <input
                        className="bg-transparent text-sm font-medium outline-none text-white flex-1 min-w-0 placeholder-gray-500"
                        value={st.name}
                        placeholder="Station name"
                        onChange={e => updateStation(st.id, { name: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      />

                      {/* Hardware count chip */}
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${hwCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                        <Layers size={10} />
                        <span>{hwCount}</span>
                      </div>

                      {/* Existing badge */}
                      {st.flags?.existing && (
                        <div className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-400">
                          Existing
                        </div>
                      )}
                    </div>

                    {/* Expandable content - Only when selected */}
                    {isSelected && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50 pt-2 animate-in slide-in-from-top-2 duration-150">
                        {/* Quick stats row */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span>{totalTti} min TTI</span>
                          {existingCount > 0 && <span className="text-yellow-400">{existingCount} existing</span>}
                          {st.dept && <span className="ml-auto px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{st.dept}</span>}
                        </div>

                        {/* Hardware as compact chips */}
                        <div className="flex flex-wrap gap-1">
                          {st.hardware.map((assoc, idx) => {
                            const hw = hwById[assoc.hid];
                            if (!hw) return null;
                            return (
                              <div
                                key={idx}
                                className={`group/hw flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${assoc.flags?.existing ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30' : 'bg-gray-700/50 text-gray-300 border border-gray-600/50'}`}
                              >
                                <span className="max-w-20 truncate">{hw.name}</span>
                                <button
                                  className="opacity-0 group-hover/hw:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-0.5"
                                  onClick={e => { e.stopPropagation(); removeHardwareFromStation(st.id, idx); }}
                                  aria-label="Remove"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}

                          {/* Add hardware button */}
                          <button
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <Plus size={10} />
                            <span>Add</span>
                          </button>
                        </div>

                        {/* Station controls row */}
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-700/30">
                          <button
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${st.flags?.existing ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700/50 text-gray-400 hover:text-gray-300'}`}
                            onClick={e => { e.stopPropagation(); updateStation(st.id, { flags: { ...st.flags, existing: !st.flags?.existing } }); }}
                          >
                            <CheckCircle size={10} />
                            <span>{st.flags?.existing ? 'Existing' : 'Mark Existing'}</span>
                          </button>

                          {/* Color picker */}
                          <div className="flex items-center gap-1 ml-auto">
                            {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'].map(color => (
                              <button
                                key={color}
                                className={`w-4 h-4 rounded-full transition-transform ${st.color === color ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-110'}`}
                                style={{ background: color }}
                                onClick={e => { e.stopPropagation(); updateStation(st.id, { color }); }}
                                aria-label={`Set color to ${color}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Resize handle - subtle, bottom-right corner */}
                    <div
                      className={`absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}
                      style={{ background: 'linear-gradient(135deg, transparent 50%, #10b981 50%)' }}
                      onMouseDown={e => { e.stopPropagation(); resizeStart(e, st.id); }}
                    />
                  </div>
                );
              })}

              {/* Labels */}
              {currentFloor?.labels.map(l => (
                <div
                  key={l.id}
                  className={`absolute select-none px-2 py-1 rounded border cursor-move ${selected.kind === 'label' && selected.id === l.id ? 'border-emerald-400' : 'border-gray-600'} bg-gray-800/80 text-xs text-white`}
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
                    <button className="text-gray-200 hover:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" onClick={e => { e.stopPropagation(); updateLabel(l.id, { rot: (l.rot + 15) % 360 }); }} aria-label="Rotate label">
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
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-gray-900/80 px-2 py-0.5 rounded border border-gray-700 text-white whitespace-nowrap">
                        {run.lengthFt} ft - {run.ttiMin} min
                      </div>
                      <button
                        className="absolute -bottom-5 right-0 text-[10px] text-red-400 bg-gray-900/80 px-1 rounded border border-gray-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

          {/* Pan/Zoom hint - Updated for infinite canvas */}
          <div className="absolute left-9 bottom-4 text-[10px] bg-gray-800/90 rounded-md px-2 py-1.5 border border-gray-700/50 text-gray-400 z-20 backdrop-blur-sm">
            <span className="text-gray-500">Pan:</span> Scroll or Space+drag
            <span className="mx-2 text-gray-600">•</span>
            <span className="text-gray-500">Zoom:</span> Alt+scroll or buttons
          </div>

          {/* Zoom indicator - Shows current zoom level */}
          <div className="absolute right-4 bottom-4 text-xs bg-gray-800/95 rounded-lg px-3 py-2 border border-gray-700 text-white z-20 flex items-center gap-2">
            <span className="text-gray-400">Zoom:</span>
            <span className="font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Scale:</span>
            <span className="font-medium">{currentFloor?.scalePxPerFt || 16} px/ft</span>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside
          className={`flex-shrink-0 border-l border-gray-800 bg-[#111827]/95 flex flex-col transition-all duration-300 ease-in-out ${rightOpen ? 'w-80' : 'w-0'}`}
          style={{ overflow: rightOpen ? 'visible' : 'hidden' }}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-1 quote-builder-scrollbar" style={{ display: rightOpen ? 'block' : 'none' }}>
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
                  <label key={integ.id} className="flex items-center justify-between gap-2 text-sm border border-gray-700 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700/50 transition-colors">
                    <div>
                      <div className="font-medium text-white text-xs">{integ.name}</div>
                      <div className="text-[10px] text-gray-400">{integ.ttiMin}m</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentLocation?.integrationIds.includes(integ.id) || false}
                      onChange={() => toggleIntegration(integ.id)}
                      className="qb-checkbox"
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
                  <label className="text-xs text-gray-400 mb-1.5 block">Travel Zone</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white"
                    value={currentLocation?.travel?.zone || 'cape'}
                    onChange={e => updateCurrentLocation(loc => {
                      const newZone = e.target.value as TravelSettings['zone'];
                      const recommendedMode = ZONE_RECOMMENDED_MODE[newZone] || 'remote';
                      const currentMode = loc.travel?.serviceMode || 'onsite';
                      // Check if we need travel discussion (on-site for distant zone)
                      const requiresDiscussion = currentMode !== 'remote' && ZONES_REQUIRING_TRAVEL_DISCUSSION.includes(newZone);

                      loc.travel = {
                        ...loc.travel,
                        zone: newZone,
                        serviceMode: recommendedMode, // Auto-switch to recommended mode
                        remote: recommendedMode === 'remote',
                        travelDiscussionRequired: requiresDiscussion
                      };
                      return loc;
                    })}
                    disabled={currentLocation?.travel?.serviceMode === 'remote'}
                  >
                    {Object.entries(TRAVEL_ZONE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Service Mode Selection */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Service Mode</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['onsite', 'hybrid', 'remote'] as ServiceMode[]).map(mode => {
                      const config = SERVICE_MODE_LABELS[mode];
                      const isSelected = (currentLocation?.travel?.serviceMode || 'onsite') === mode;
                      const isRecommended = ZONE_RECOMMENDED_MODE[currentLocation?.travel?.zone || 'cape'] === mode;
                      const Icon = mode === 'onsite' ? Building2 : mode === 'hybrid' ? Globe : Wifi;

                      return (
                        <button
                          key={mode}
                          onClick={() => setServiceMode(mode)}
                          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300'
                              : 'border-gray-600 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                          }`}
                          title={config.description}
                        >
                          <Icon size={16} className={isSelected ? 'text-emerald-400' : ''} />
                          <span className="font-medium">{config.label}</span>
                          {isRecommended && !isSelected && (
                            <span className="text-[9px] text-amber-400 -mt-0.5">Recommended</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Travel Discussion Required Notice */}
                {currentLocation?.travel?.travelDiscussionRequired && (
                  <div className="flex items-start gap-2 p-2 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-200">
                      <span className="font-medium">Travel discussion required</span>
                      <p className="text-amber-300/80 mt-0.5">
                        On-site service for this location requires a travel consultation. Final travel costs will be quoted separately.
                      </p>
                    </div>
                  </div>
                )}

                {/* Island Options (show when not remote and island zone) */}
                {currentLocation?.travel?.zone === 'island' && currentLocation?.travel?.serviceMode !== 'remote' && (
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-white bg-gray-700/50 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-700">
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
                    <label className="flex items-center gap-1.5 text-xs text-white bg-gray-700/50 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-700">
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
                  </div>
                )}

                {/* Go-Live Support */}
                <div className="pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!currentLocation?.goLiveSupportEnabled}
                        onChange={e => updateCurrentLocation(loc => {
                          loc.goLiveSupportEnabled = e.target.checked;
                          if (!e.target.checked) {
                            loc.goLiveSupportDays = undefined;
                            loc.goLiveSupportDate = undefined;
                          } else if (!loc.goLiveSupportDays) {
                            loc.goLiveSupportDays = 1; // Default to 1 day
                          }
                          return loc;
                        })}
                        className="accent-emerald-500"
                      />
                      Go-Live Support
                    </label>
                    <span className="text-[10px] text-gray-500">On-site opening support</span>
                  </div>

                  {currentLocation?.goLiveSupportEnabled && (
                    <div className="space-y-2 pl-4">
                      {/* Duration selection */}
                      <div className="flex flex-wrap gap-1.5">
                        {GO_LIVE_SUPPORT_OPTIONS.map(opt => (
                          <button
                            key={opt.days}
                            className={`px-2 py-1 text-xs rounded-lg border transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                              currentLocation.goLiveSupportDays === opt.days
                                ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300'
                                : 'border-gray-600 text-gray-300 hover:bg-gray-700/50'
                            }`}
                            onClick={() => updateCurrentLocation(loc => {
                              loc.goLiveSupportDays = opt.days;
                              return loc;
                            })}
                            title={opt.description}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Date picker */}
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">Go-Live Date</label>
                        <input
                          type="date"
                          value={currentLocation.goLiveSupportDate || ''}
                          onChange={e => updateCurrentLocation(loc => {
                            loc.goLiveSupportDate = e.target.value || undefined;
                            return loc;
                          })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      {/* Description of selected option */}
                      {currentLocation.goLiveSupportDays && (
                        <div className="text-[10px] text-gray-500 italic">
                          {GO_LIVE_SUPPORT_OPTIONS.find(o => o.days === currentLocation.goLiveSupportDays)?.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Support Tiers */}
                <div className="pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Support Plan</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SUPPORT_TIERS.map(pct => (
                      <button
                        key={pct}
                        className={`py-1.5 text-center rounded-lg border text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors ${supportTier === pct ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300' : 'border-gray-600 text-gray-300 hover:bg-gray-700/50'}`}
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
                  <div className="h-px bg-gray-700 my-2" />
                  <SummaryRow
                    label="Est. install time"
                    raw={serverQuote?.timeEstimate ? `${serverQuote.timeEstimate.minHours}-${serverQuote.timeEstimate.maxHours} hrs` : '--'}
                  />
                  <SummaryRow label="Install cost" dollars={estimate.installCost} />
                  <SummaryRow
                    label={`Support (${supportPeriod === 'monthly' ? 'Mo' : 'Yr'})`}
                    dollars={supportPeriod === 'monthly' ? estimate.supportMonthly : estimate.supportAnnual}
                  />
                  {estimate.goLiveSupportCost > 0 && (
                    <SummaryRow
                      label={`Go-Live Support (${estimate.goLiveSupportDays} day${estimate.goLiveSupportDays !== 1 ? 's' : ''})`}
                      dollars={estimate.goLiveSupportCost}
                    />
                  )}
                  <div className="h-px bg-gray-700 my-2" />
                  <SummaryRow label="Install + Travel" dollars={estimate.installCost + estimate.travelCost} strong />
                  <SummaryRow
                    label={`Total (first ${supportPeriod === 'monthly' ? 'mo' : 'yr'})`}
                    dollars={estimate.combinedFirst}
                    strong
                  />
                </div>

                <div className="pt-3 border-t border-gray-700 space-y-2">
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <Mail size={14} /> Email Quote
                  </button>
                  <button
                    onClick={exportJSON}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
      <footer className="flex-shrink-0 border-t border-gray-700 bg-gray-900/95 backdrop-blur z-20">
        <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto">
          {/* Layer controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Layers size={12} className="text-gray-400" />
            <select
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
              value={activeLayerId}
              onChange={e => setActiveLayerId(e.target.value)}
            >
              {currentFloor?.layers.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button onClick={addLayer} className="bg-gray-700 hover:bg-gray-600 rounded p-1 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none" title="Add Layer">
              <Plus size={12} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-700 mx-1 flex-shrink-0" />

          {/* Layer visibility toggles */}
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            {currentFloor?.layers.map(l => (
              <label key={l.id} className="flex items-center gap-1 cursor-pointer text-gray-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => toggleLayerVisibility(l.id)}
                  className="qb-checkbox w-3 h-3"
                />
                <span className="text-[11px]">{l.name}</span>
              </label>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-700 mx-1 flex-shrink-0" />

          {/* Cable run button */}
          {activeLayer?.type === 'network' && (
            <button
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors flex-shrink-0 ${mode === 'addCable' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
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
            <span className="text-[10px] text-gray-400">Scale</span>
            <input
              type="number"
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white w-12"
              value={currentFloor?.scalePxPerFt || 16}
              onChange={e => updateCurrentLocation(loc => {
                const f = loc.floors.find(fl => fl.id === currentFloor?.id);
                if (f) f.scalePxPerFt = Math.max(4, Number(e.target.value) || 16);
                return loc;
              })}
            />
            <span className="text-[10px] text-gray-400">px/ft</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom controls in footer */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))}
              className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] text-gray-300 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}
              className="p-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => { setZoom(1); resetPan(); }}
              className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
              title="Reset view"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="w-px h-5 bg-gray-700 mx-1 flex-shrink-0" />

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
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-700">
            {emailStatus.type === 'success' ? (
              // Success state
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Quote Sent!</h3>
                <p className="text-gray-300 mb-6">{emailStatus.message}</p>
                <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailStatus({ type: 'idle', message: '' });
                    setEmailForm({ name: '', email: '', restaurantName: '', phone: '' });
                  }}
                  className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  Close
                </button>
              </div>
            ) : (
              // Form state
              <>
                <h3 className="font-serif text-2xl font-bold text-white mb-2">Save Your Quote</h3>
                <p className="text-gray-200 mb-4 text-sm">Enter your details and we'll send you this itemized breakdown immediately.</p>
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      disabled={emailSending}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Phone</label>
                    <input
                      type="tel"
                      value={emailForm.phone}
                      onChange={(e) => setEmailForm({ ...emailForm, phone: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                      className="flex-1 py-2 text-gray-200 hover:bg-gray-700 rounded-lg border border-gray-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

      {/* Lead/Client Search Modal */}
      {showLeadSearch && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20">
          <div className="bg-gray-800 rounded-xl w-full max-w-md shadow-2xl border border-gray-700">
            {/* Search Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Link to Client or Lead</h3>
                <button
                  onClick={() => { setShowLeadSearch(false); setLeadSearchQuery(''); setLeadSearchResults([]); }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                  placeholder="Search by name, email, or location..."
                  value={leadSearchQuery}
                  onChange={e => setLeadSearchQuery(e.target.value)}
                  autoFocus
                />
                {leadSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Link a client or lead to auto-populate intelligence data for accurate pricing
              </p>
            </div>

            {/* Search Results */}
            <div className="max-h-80 overflow-y-auto">
              {leadSearchResults.length === 0 && leadSearchQuery.length >= 2 && !leadSearchLoading && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No matches found. Try a different search term.
                </div>
              )}
              {leadSearchResults.map(result => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => loadIntelligence(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-700/50 border-b border-gray-700/50 last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      result.type === 'client' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                    }`}>
                      <Building2 size={16} className={result.type === 'client' ? 'text-emerald-400' : 'text-blue-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{result.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          result.type === 'client' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {result.type === 'client' ? 'Client' : 'Lead'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {result.address || result.email || 'No address'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {result.pos_system && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                            {result.pos_system}
                          </span>
                        )}
                        {result.cuisine_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                            {result.cuisine_type}
                          </span>
                        )}
                        {result.service_style && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            {result.service_style.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {result.score && (
                      <div className="text-xs text-gray-500">
                        Score: {result.score}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Intelligence Info */}
            {intelligenceData && (
              <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                <div className="text-xs text-gray-400 mb-2">Currently linked:</div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{intelligenceData.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    intelligenceData.source === 'client' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {Math.round(intelligenceData.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import PDF Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Import Toast PDF
              </h3>
              <button
                onClick={resetImportModal}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {importStatus === 'idle' && (
              <>
                <p className="text-gray-300 text-sm mb-4">
                  Upload a Toast quote or order PDF to automatically extract hardware items.
                </p>
                <div
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer"
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
                  <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">Drop PDF here or click to browse</p>
                  <p className="text-gray-400 text-xs">Accepts Toast quote PDFs (max 10MB)</p>
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
                <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="py-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Import Failed</p>
                <p className="text-red-300 text-sm mb-4">{importError}</p>
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {importStatus === 'complete' && (
              <>
                <div className="flex items-center gap-2 text-green-400 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    Extracted {stationGroups.length} station{stationGroups.length !== 1 ? 's' : ''}, {ungroupedItems.length + extractedItems.length} item{ungroupedItems.length + extractedItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Client Info - Editable (always show when import complete) */}
                {(extractedClientInfo || importStatus === 'complete') && (
                  <div className="mb-3 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                    <p className="text-blue-300 text-xs font-medium mb-2">Client Info (editable)</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Business Name"
                        value={extractedClientInfo?.businessName || ''}
                        onChange={e => setExtractedClientInfo(prev => ({ ...(prev || {}), businessName: e.target.value } as ExtractedClientInfo))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Address"
                        value={extractedClientInfo?.address || ''}
                        onChange={e => setExtractedClientInfo(prev => ({ ...(prev || {}), address: e.target.value } as ExtractedClientInfo))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="City"
                          value={extractedClientInfo?.city || ''}
                          onChange={e => setExtractedClientInfo(prev => ({ ...(prev || {}), city: e.target.value } as ExtractedClientInfo))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={extractedClientInfo?.state || ''}
                          onChange={e => setExtractedClientInfo(prev => ({ ...(prev || {}), state: e.target.value } as ExtractedClientInfo))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="ZIP"
                          value={extractedClientInfo?.zip || ''}
                          onChange={e => setExtractedClientInfo(prev => ({ ...(prev || {}), zip: e.target.value } as ExtractedClientInfo))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Software/Integrations (if detected) */}
                {extractedSoftware.length > 0 && (
                  <div className="mb-3 p-2 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                    <p className="text-purple-300 text-xs font-medium mb-1">Software Detected</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedSoftware.map((sw, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-purple-600/50 text-purple-200 rounded">
                          {sw.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview extracted items - grouped */}
                <div className="max-h-64 overflow-y-auto mb-4 space-y-3">
                  {/* Station Groups */}
                  {stationGroups.map((group, gIdx) => (
                    <div key={gIdx} className="border border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-700/70 px-3 py-2 flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{group.name}</span>
                        <span className="text-purple-400 text-xs">
                          {group.quantity > 1 ? `×${group.quantity} stations` : `${group.items.length} items`}
                        </span>
                      </div>
                      <div className="p-2 space-y-1">
                        {group.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-800/50 rounded">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-200 text-xs truncate">{item.productName}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-purple-400 text-xs">×{item.quantity}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.mappedHardwareIds.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Ungrouped Items */}
                  {(ungroupedItems.length > 0 || (extractedItems.length > 0 && stationGroups.length === 0)) && (
                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-700/70 px-3 py-2">
                        <span className="text-gray-300 text-sm font-medium">Other Hardware</span>
                      </div>
                      <div className="p-2 space-y-1">
                        {(ungroupedItems.length > 0 ? ungroupedItems : extractedItems).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-800/50 rounded">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-200 text-xs truncate">{item.productName}</p>
                              <p className="text-gray-500 text-[10px]">
                                {item.mappedHardwareIds.length > 0 ? item.mappedHardwareIds.join(', ') : 'Needs mapping'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-purple-400 text-xs">×{item.quantity}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.mappedHardwareIds.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stationGroups.length === 0 && ungroupedItems.length === 0 && extractedItems.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No hardware items found in the PDF</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetImportModal}
                    className="flex-1 py-2 text-gray-200 hover:bg-gray-700 rounded-lg border border-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importExtractedHardware}
                    disabled={stationGroups.length === 0 && ungroupedItems.length === 0 && extractedItems.length === 0}
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
