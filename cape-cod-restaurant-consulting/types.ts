import { LucideIcon } from 'lucide-react';

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  link: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  restaurant: string;
}

export enum StationType {
  EXPO = 'Expo (KDS)',
  SERVER = 'Server Station',
  BAR = 'Bartender Station',
  TAKEOUT = 'Take-Out Station',
  MANAGER = 'Manager Station'
}

export interface StationConfig {
  type: StationType;
  baseCost: number;
  complexityScore: number;
  hardware: string[];
}

export interface PlacedStation {
  id: string;
  type: StationType;
  x: number;
  y: number;
}

export interface QuoteState {
  stations: PlacedStation[];
  travelZone: number; // 0 = Local, 1 = Mid, 2 = Far
  cablingNeeded: boolean;
  trainingHours: number;
}
