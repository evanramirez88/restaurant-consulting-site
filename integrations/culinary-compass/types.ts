export type Region = "Upper Cape" | "Mid Cape" | "Lower Cape" | "Outer Cape";

export type PosSystem = "Toast" | "Square" | "Aloha" | "Micros" | "Clover" | "Lightspeed" | "Upserve" | "Unknown";

export interface HistoryRecord {
    period: string;
    name: string;
    notes: string;
}

// --- NEW: Consultant Data Types ---

export type FactStatus = 'pending' | 'approved' | 'rejected';

export interface AtomicFact {
    id: string;
    restaurantId: string; // The ID of the target restaurant
    field: keyof Restaurant | 'historyNote'; // What field to update
    value: any; // The new value
    originalText: string; // The raw source text
    confidence: number; // AI confidence score
    status: FactStatus;
}

export interface Restaurant {
    id: string;
    name: string;
    town: string;
    region: Region;
    type: string; // e.g., Seafood, Fine Dining, Casual
    price: 1 | 2 | 3 | 4;
    rating: number; // 1.0 - 5.0
    seasonal: boolean;
    desc: string;
    
    // Consultant / Business Intelligence Fields
    address?: string; // For linking to public records
    licenseNumber?: string; // For gov database lookups
    licenseType?: "Common Victualler" | "Liquor (Full)" | "Liquor (Beer/Wine)" | "Seasonal";
    seatingCapacity?: number;
    healthScore?: number; // 0-100 (Simulated)
    lastInspectionDate?: string;
    
    // Tech Stack
    posSystem: PosSystem;
    onlineOrdering?: "Toast" | "Grubhub" | "UberEats" | "DoorDash" | "Direct" | "None";
    
    // Digital Presence
    website?: string;
    socials?: {
        instagram?: string;
        facebook?: string;
    };
    
    // The "Flip Book" backwards in time
    locationHistory: HistoryRecord[];

    // Extension: Client-specific pending facts
    pendingFacts?: AtomicFact[]; 
}