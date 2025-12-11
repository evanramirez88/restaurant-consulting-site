import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
  Copy,
  Edit3,
  MapPin,
  Layers,
  Cable,
  Building2,
  Save,
  Calendar
} from 'lucide-react';
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
  TravelSettings
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
// MAIN COMPONENT
// ============================================

const QuoteBuilder: React.FC = () => {
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
  const [mode, setMode] = useState<'idle' | 'addCable'>('idle');
  const [pendingCableStart, setPendingCableStart] = useState<{ x: number; y: number } | null>(null);
  const [leftOpen, setLeftOpen] = usePersistentState(LS_KEY + ":leftOpen", true);
  const [rightOpen, setRightOpen] = usePersistentState(LS_KEY + ":rightOpen", true);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

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
  // ESTIMATION ENGINE
  // ============================================

  const estimate = useMemo(() => {
    if (!currentFloor) return {
      items: [],
      mins: { hardware: 0, overhead: 0, integrations: 0, cabling: 0 },
      totalMin: 0,
      installCost: 0,
      travelCost: 0,
      supportMonthly: 0,
      supportAnnual: 0,
      combinedFirst: 0
    };

    const items: Array<{ type: string; label: string; minutes: number; dollars: number }> = [];
    const mins = { hardware: 0, overhead: 0, integrations: 0, cabling: 0 };

    // Stations & hardware
    currentFloor.stations.forEach(st => {
      const stationExisting = !!st.flags?.existing && !st.flags?.replace;
      if (!stationExisting) {
        mins.overhead += STATION_OVERHEAD_MIN;
        items.push({
          type: 'overhead',
          label: `Station overhead - ${st.name}`,
          minutes: STATION_OVERHEAD_MIN,
          dollars: (STATION_OVERHEAD_MIN / 60) * rates.hourly
        });
      }
      st.hardware.forEach(assoc => {
        const hw = hwById[assoc.hid];
        if (!hw) return;
        const assocExisting = !!assoc.flags?.existing && !assoc.flags?.replace;
        if (stationExisting || assocExisting) return;
        mins.hardware += hw.ttiMin;
        items.push({
          type: 'hardware',
          label: `${hw.name} - ${st.name}`,
          minutes: hw.ttiMin,
          dollars: (hw.ttiMin / 60) * rates.hourly
        });
      });
    });

    // Integrations
    currentLocation?.integrationIds.forEach(id => {
      const integ = integrations.find(i => i.id === id);
      if (!integ) return;
      mins.integrations += integ.ttiMin;
      items.push({
        type: 'integration',
        label: `Integration - ${integ.name}`,
        minutes: integ.ttiMin,
        dollars: (integ.ttiMin / 60) * rates.hourly
      });
    });

    // Cable runs
    currentFloor.layers
      .filter(l => l.type === 'network')
      .forEach(layer => {
        layer.cableRuns.forEach(run => {
          mins.cabling += run.ttiMin;
          items.push({
            type: 'cabling',
            label: `Cable run ${run.lengthFt} ft`,
            minutes: run.ttiMin,
            dollars: (run.ttiMin / 60) * rates.hourly
          });
        });
      });

    const totalMin = Math.round(Object.values(mins).reduce((a, b) => a + b, 0));
    const installCost = (totalMin / 60) * rates.hourly;
    const travelCost = currentLocation ? computeTravelCost(currentLocation) : 0;

    const tierPct = supportTier / 100;
    const supportMonthly = tierPct * installCost;
    const supportAnnual = supportMonthly * 12 * 0.95;
    const supportNow = supportPeriod === 'monthly' ? supportMonthly : supportAnnual;
    const combinedFirst = installCost + travelCost + supportNow;

    return { items, mins, totalMin, installCost, travelCost, supportMonthly, supportAnnual, combinedFirst };
  }, [currentFloor, currentLocation, integrations, rates, supportTier, supportPeriod, hwById, computeTravelCost]);

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

  return (
    <div className="bg-slate-900 min-h-screen relative">
      {/* Header Toolbar */}
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-white font-semibold text-sm mr-4">Quote Builder - POS + Networking</h1>

          {/* Location selector */}
          <select
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            value={locId}
            onChange={e => setLocId(e.target.value)}
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button onClick={addLocation} className="bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded-lg px-3 py-2 text-sm text-white flex items-center gap-2">
            <Plus size={14} /> Location
          </button>

          {/* Address input */}
          <input
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white w-64"
            placeholder="Location Address (auto-detects zone)"
            value={currentLocation?.address || ''}
            onChange={e => setAddress(e.target.value)}
          />

          {/* Floor selector */}
          <select
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
            value={floorId}
            onChange={e => setFloorId(e.target.value)}
          >
            {currentLocation?.floors.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={addFloor} className="bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded-lg px-3 py-2 text-sm text-white flex items-center gap-2">
            <Plus size={14} /> Floor
          </button>
        </div>
      </header>

      <div className="flex relative" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Left Sidebar */}
        {leftOpen && (
          <aside className="w-80 border-r border-slate-700 bg-slate-900/95 overflow-y-auto p-4 space-y-4">
            <button
              onClick={() => setLeftOpen(false)}
              className="absolute top-2 right-2 text-slate-400 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Blank Station */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Add Station</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => addStation('Blank Station')}
                  className="bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  + Blank Station
                </button>
                <select
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white flex-1"
                  onChange={e => { if (e.target.value) addStation(e.target.value); e.target.value = ''; }}
                  defaultValue=""
                >
                  <option value="" disabled>Common Names...</option>
                  {COMMON_STATION_NAMES.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Templates */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Station Templates</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {STATION_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => addTemplateStation(t)}
                    className="w-full text-left px-3 py-2 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: t.color }}>{t.label}</span>
                      <span className="text-xs text-slate-400">{t.ttiMin} min</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Catalog */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Hardware (Labor Only)</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hardwareCatalog.map(hw => (
                  <div key={hw.id} className="border border-slate-600 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-white">{hw.name}</div>
                        <div className="text-xs text-slate-400">{hw.category} - TTI: {hw.ttiMin} min</div>
                      </div>
                    </div>
                    {selected.kind === 'station' && (
                      <button
                        onClick={() => addHardwareToStation(selected.id!, hw.id)}
                        className="mt-2 w-full bg-slate-700 hover:bg-slate-600 rounded px-2 py-1 text-xs text-white"
                      >
                        Add to: {currentFloor?.stations.find(s => s.id === selected.id)?.name || "Station"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* FOH/BOH Objects */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Objects</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-slate-500 mb-1">FOH</div>
                  {FOH_OBJECTS.map(o => (
                    <button
                      key={o.type}
                      onClick={() => addObject(o)}
                      className="w-full text-left px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 mb-1 text-white"
                    >
                      {o.type}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">BOH</div>
                  {BOH_OBJECTS.map(o => (
                    <button
                      key={o.type}
                      onClick={() => addObject(o)}
                      className="w-full text-left px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 mb-1 text-white"
                    >
                      {o.type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-500 mb-1">Structure</div>
                <div className="flex flex-wrap gap-1">
                  {STRUCTURE_OBJECTS.map(o => (
                    <button
                      key={o.type}
                      onClick={() => addObject(o)}
                      className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 text-white"
                    >
                      {o.type}
                    </button>
                  ))}
                  <button
                    onClick={addLabel}
                    className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700/50 text-white"
                  >
                    + Label
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800 border border-slate-600 rounded-r-lg p-2 text-slate-400 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-slate-950" onClick={() => setSelected({ kind: null, id: null })}>
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)`,
              backgroundSize: `${gridSize}px ${gridSize}px`
            }}
          />

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="absolute inset-0 overflow-auto"
            onClick={canvasClick}
            style={{ cursor: mode === 'addCable' ? 'crosshair' : 'default' }}
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
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white" onClick={() => updateObject(o.id, { w: o.w + 10 })}>W+</button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white" onClick={() => updateObject(o.id, { w: Math.max(10, o.w - 10) })}>W-</button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-white" onClick={() => updateObject(o.id, { rot: (o.rot + 15) % 360 })}><RotateCw size={10} /></button>
                    <button className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-[10px] text-red-400" onClick={() => removeObject(o.id)}><Trash2 size={10} /></button>
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
                    <button className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-red-400 hover:bg-red-900/50" onClick={() => removeStation(st.id)}>
                      <Trash2 size={12} />
                    </button>
                    <button className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white" onClick={() => {
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
                      className={`w-6 h-6 rounded-full bg-slate-900 border flex items-center justify-center text-xs ${st.flags?.existing ? 'border-yellow-400 text-yellow-400' : 'border-slate-600 text-slate-400'}`}
                      title="Mark as Existing"
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
                    {st.dept && <span className="ml-auto text-[10px] text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">{st.dept}</span>}
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
                            <span className="text-slate-400">- {hw.ttiMin} min</span>
                            {assoc.flags?.existing && !assoc.flags?.replace && <span className="ml-auto text-[10px] text-yellow-300">Existing</span>}
                          </div>
                          <div className="absolute top-0 right-1 flex gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              className={`text-[10px] ${assoc.flags?.existing ? 'text-yellow-400' : 'text-slate-500'}`}
                              onClick={() => updateHardwareAssoc(st.id, idx, { flags: { ...assoc.flags, existing: !assoc.flags?.existing } })}
                            >
                              E
                            </button>
                            <button className="text-[10px] text-red-400" onClick={() => removeHardwareFromStation(st.id, idx)}>x</button>
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
                            className="text-[9px] bg-slate-700 hover:bg-slate-600 rounded px-1.5 py-0.5 text-white"
                            onClick={e => { e.stopPropagation(); addHardwareToStation(st.id, hw.id); }}
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
                      className="bg-transparent outline-none text-xs w-20 text-white"
                      value={l.text}
                      onChange={e => updateLabel(l.id, { text: e.target.value })}
                      onClick={e => e.stopPropagation()}
                    />
                    <button className="text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); updateLabel(l.id, { rot: (l.rot + 15) % 360 }); }}>
                      <RotateCw size={10} />
                    </button>
                    <button className="text-red-400" onClick={e => { e.stopPropagation(); removeLabel(l.id); }}>
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
                        className="absolute -bottom-5 right-0 text-[10px] text-red-400 bg-slate-900/80 px-1 rounded border border-slate-700"
                        onClick={e => { e.stopPropagation(); removeCable(layer.id, run.id); }}
                      >
                        remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute right-4 bottom-4 flex items-center gap-2 bg-slate-800/90 rounded-lg px-3 py-2 border border-slate-600">
            <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))} className="text-white hover:text-emerald-400">
              <ZoomIn size={18} />
            </button>
            <span className="text-sm text-white">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="text-white hover:text-emerald-400">
              <ZoomOut size={18} />
            </button>
            <button onClick={() => setZoom(1)} className="text-slate-400 hover:text-white ml-2">
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Scale chip */}
          <div className="absolute right-4 bottom-16 text-xs bg-slate-800/90 rounded-full px-3 py-1 border border-slate-600 text-white">
            Grid: 1 ft squares - 1 ft = {currentFloor?.scalePxPerFt || 16} px
          </div>
        </div>

        {/* Right Sidebar */}
        {rightOpen && (
          <aside className="w-96 border-l border-slate-700 bg-slate-900/95 overflow-y-auto p-4 space-y-4">
            <button
              onClick={() => setRightOpen(false)}
              className="absolute top-2 left-2 text-slate-400 hover:text-white"
            >
              <ChevronRight size={18} />
            </button>

            {/* Integrations */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Location Integrations</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {integrations.map(integ => (
                  <label key={integ.id} className="flex items-center justify-between gap-2 text-sm border border-slate-600 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50">
                    <div>
                      <div className="font-medium text-white">{integ.name}</div>
                      <div className="text-[10px] text-slate-400">TTI: {integ.ttiMin} min</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={currentLocation?.integrationIds.includes(integ.id) || false}
                      onChange={() => toggleIntegration(integ.id)}
                      className="accent-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Travel & Support */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Travel & Support Plan</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Travel Zone</label>
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
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-white">
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
                      <label className="flex items-center gap-2 text-xs text-white">
                        <input
                          type="checkbox"
                          checked={!!currentLocation?.travel?.islandVehicle}
                          onChange={e => updateCurrentLocation(loc => {
                            loc.travel = { ...loc.travel, islandVehicle: e.target.checked };
                            return loc;
                          })}
                          className="accent-emerald-500"
                        />
                        Vehicle ferry
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white">
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
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-xs text-slate-400 mb-2">Support Plan Tiers</div>
                <div className="grid grid-cols-4 gap-2">
                  {SUPPORT_TIERS.map(pct => (
                    <button
                      key={pct}
                      className={`py-2 text-center rounded-lg border text-sm ${supportTier === pct ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300' : 'border-slate-600 text-slate-400 hover:bg-slate-700/50'}`}
                      onClick={() => setSupportTier(pct)}
                    >
                      {pct === 0 ? 'None' : `${pct}%`}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="radio"
                      name="period"
                      checked={supportPeriod === 'monthly'}
                      onChange={() => setSupportPeriod('monthly')}
                      className="accent-emerald-500"
                    />
                    Monthly
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="radio"
                      name="period"
                      checked={supportPeriod === 'annual'}
                      onChange={() => setSupportPeriod('annual')}
                      className="accent-emerald-500"
                    />
                    Annual (5% off)
                  </label>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-brand-dark rounded-xl p-4 border border-slate-600">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Payment Summary</h3>

              <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                <SummaryRow label="Hardware labor" minutes={estimate.mins.hardware} rate={rates.hourly} />
                <SummaryRow label="Station overhead" minutes={estimate.mins.overhead} rate={rates.hourly} />
                <SummaryRow label="Integrations" minutes={estimate.mins.integrations} rate={rates.hourly} />
                <SummaryRow label="Networking & cabling" minutes={estimate.mins.cabling} rate={rates.hourly} />
                <SummaryRow label="Travel" dollars={estimate.travelCost} />
                <div className="h-px bg-slate-600 my-2" />
                <SummaryRow label="Install time" raw={minutesToHm(estimate.totalMin)} />
                <SummaryRow label="Install cost" dollars={estimate.installCost} />
                <SummaryRow
                  label={`Support Plan (${supportPeriod === 'monthly' ? 'Monthly' : 'Annual'})`}
                  dollars={supportPeriod === 'monthly' ? estimate.supportMonthly : estimate.supportAnnual}
                />
                <div className="h-px bg-slate-600 my-2" />
                <SummaryRow label="Install + Travel" dollars={estimate.installCost + estimate.travelCost} strong />
                <SummaryRow
                  label={`Total (incl. first ${supportPeriod === 'monthly' ? 'month' : 'year'})`}
                  dollars={estimate.combinedFirst}
                  strong
                />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-600 space-y-2">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full py-2.5 bg-brand-accent text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Email Quote
                </button>
                <button
                  onClick={exportJSON}
                  className="w-full py-2.5 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Export JSON
                </button>
              </div>
            </div>
          </aside>
        )}

        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800 border border-slate-600 rounded-l-lg p-2 text-slate-400 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Bottom Toolbar */}
      <footer className="sticky bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
          {/* Layer controls */}
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-400" />
            <select
              className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              value={activeLayerId}
              onChange={e => setActiveLayerId(e.target.value)}
            >
              {currentFloor?.layers.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button onClick={addLayer} className="bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded-lg px-2 py-1.5 text-sm text-white">
              + Layer
            </button>
          </div>

          {/* Layer visibility toggles */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {currentFloor?.layers.map(l => (
              <label key={l.id} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => toggleLayerVisibility(l.id)}
                  className="accent-emerald-500"
                />
                <span className="text-white">{l.name}</span>
              </label>
            ))}
          </div>

          {/* Cable run button */}
          {activeLayer?.type === 'network' && (
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${mode === 'addCable' ? 'bg-cyan-600 text-white' : 'bg-slate-800 border border-slate-600 text-white hover:bg-slate-700'}`}
              onClick={() => {
                setMode(mode === 'addCable' ? 'idle' : 'addCable');
                setPendingCableStart(null);
              }}
            >
              <Cable size={14} />
              {mode === 'addCable' ? 'Click start/end on map...' : '+ Add Cable Run'}
            </button>
          )}

          {/* Scale control */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-slate-400">Scale</span>
            <input
              type="number"
              className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white w-20"
              value={currentFloor?.scalePxPerFt || 16}
              onChange={e => updateCurrentLocation(loc => {
                const f = loc.floors.find(fl => fl.id === currentFloor?.id);
                if (f) f.scalePxPerFt = Math.max(4, Number(e.target.value) || 16);
                return loc;
              })}
            />
            <span className="text-xs text-slate-400">px/ft</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={resetFloor}
              className="bg-red-900/50 border border-red-700 hover:bg-red-800/50 rounded-lg px-3 py-1.5 text-sm text-red-300"
            >
              Reset Floor
            </button>
          </div>
        </div>
      </footer>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-600">
            <h3 className="font-serif text-2xl font-bold text-white mb-2">Save Your Quote</h3>
            <p className="text-slate-400 mb-4 text-sm">Enter your details and we'll send you this itemized breakdown immediately.</p>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                setShowEmailModal(false);
                alert('Quote request sent! (Simulation - will be connected to backend)');
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input type="text" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input type="email" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Restaurant Name</label>
                <input type="text" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2 text-slate-400 hover:bg-slate-700 rounded-lg border border-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-brand-accent text-white rounded-lg hover:bg-amber-600">
                  Send Quote
                </button>
              </div>
            </form>
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
      <span className="text-slate-300">{label}</span>
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
