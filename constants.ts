import { StationType, StationConfig } from './types';

export const COMPANY_NAME = "Cape Cod Restaurant Consulting";
export const OWNER_NAME = "Evan Ramirez";
export const PHONE_NUMBER = "(508) 247-4936";
export const EMAIL_ADDRESS = "evanramirez@ccrestaurantconsulting.com";

export const PRICING_CONSTANTS = {
  HOURLY_RATE: 110,
  TRAVEL_ZONES: [0, 150, 300], // Flat fees for travel
  CABLING_PER_DROP: 225,
  TRAINING_RATE: 150,
};

export const STATION_CONFIGS: Record<StationType, StationConfig> = {
  [StationType.EXPO]: {
    type: StationType.EXPO,
    baseCost: 450,
    complexityScore: 1.5,
    hardware: ['KDS Screen', 'Mount', 'Impact Printer', 'Switch']
  },
  [StationType.SERVER]: {
    type: StationType.SERVER,
    baseCost: 350,
    complexityScore: 1.0,
    hardware: ['Terminal', 'Receipt Printer', 'Cash Drawer']
  },
  [StationType.BAR]: {
    type: StationType.BAR,
    baseCost: 400,
    complexityScore: 1.2,
    hardware: ['Terminal', 'Receipt Printer', 'Cash Drawer', 'Mount']
  },
  [StationType.TAKEOUT]: {
    type: StationType.TAKEOUT,
    baseCost: 250,
    complexityScore: 0.8,
    hardware: ['Terminal', 'Receipt Printer']
  },
  [StationType.MANAGER]: {
    type: StationType.MANAGER,
    baseCost: 200,
    complexityScore: 0.5,
    hardware: ['All-in-One PC' ,'Network Bridge']
  }
};

export const NAVIGATION = [
  { name: 'Home', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'About', path: '/about' },
  { name: 'Quote Builder', path: '/quote' },
  { name: 'Contact', path: '/contact' },
];