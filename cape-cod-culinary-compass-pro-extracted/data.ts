import { Restaurant } from './types';

// Helper to generate consistent IDs
const generateId = (name: string, town: string) => `${name.toLowerCase().replace(/\s/g, '-')}-${town.toLowerCase().replace(/\s/g, '-')}`;

export const ESTABLISHMENTS: Restaurant[] = [
    // --- PROVINCETOWN (Outer Cape) ---
    {
        id: generateId("The Lobster Pot", "Provincetown"),
        name: "The Lobster Pot",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Seafood",
        price: 3,
        rating: 4.6,
        seasonal: false,
        desc: "Iconic neon sign, waterfront dining, famous lobster bisque.",
        address: "321 Commercial St, Provincetown, MA",
        licenseNumber: "ABCC-12345",
        licenseType: "Liquor (Full)",
        seatingCapacity: 180,
        healthScore: 98,
        lastInspectionDate: "2024-05-15",
        posSystem: "Aloha",
        onlineOrdering: "None",
        website: "https://ptownlobsterpot.com",
        locationHistory: [
            { period: "1979-Present", name: "The Lobster Pot", notes: "Current ownership (McNulty family). Expanded to second floor in 1985." },
            { period: "1940s-1978", name: "Various Retail/Dining", notes: "Site housed a small lunch counter and souvenir shop." },
            { period: "Late 1800s", name: "Whaling Storage", notes: "Used for maritime equipment storage." }
        ]
    },
    {
        id: generateId("The Canteen", "Provincetown"),
        name: "The Canteen",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Casual",
        price: 2,
        rating: 4.7,
        seasonal: false,
        desc: "Communal seating, lobster rolls, and cod banh mi.",
        address: "225 Commercial St, Provincetown, MA",
        posSystem: "Square",
        onlineOrdering: "Direct",
        website: "https://thecanteenptown.com",
        seatingCapacity: 60,
        healthScore: 99,
        locationHistory: [
            { period: "2013-Present", name: "The Canteen", notes: "Founded by Rob Anderson and Loic Rossignol." },
            { period: "Pre-2013", name: "Private Residence/Retail", notes: "Historic 19th century building." }
        ]
    },
    {
        id: generateId("Spiritus Pizza", "Provincetown"),
        name: "Spiritus Pizza",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Takeout",
        price: 1,
        rating: 4.5,
        seasonal: true,
        desc: "Late-night staple, thin crust, local gathering spot.",
        posSystem: "Toast",
        onlineOrdering: "Toast",
        seatingCapacity: 0,
        healthScore: 95,
        locationHistory: [
            { period: "1970-Present", name: "Spiritus Pizza", notes: "Founded by John Yupcavage. Became a cultural hub in the 80s." }
        ]
    },
    {
        id: generateId("Fanizzis", "Provincetown"),
        name: "Fanizzi's",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Fine Dining",
        price: 3,
        rating: 4.6,
        seasonal: false,
        desc: "Italian-American, dramatic dining room overhanging the harbor.",
        posSystem: "Micros",
        healthScore: 96,
        locationHistory: [
             { period: "2000s-Present", name: "Fanizzi's by the Sea", notes: "Converted from private waterfront property." },
             { period: "1900s", name: "Sea Captain's Home", notes: "Original foundation still visible." }
        ]
    },
    {
        id: generateId("The Mews", "Provincetown"),
        name: "The Mews Restaurant & Cafe",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Fine Dining",
        price: 4,
        rating: 4.8,
        seasonal: false,
        desc: "Upscale waterfront dining and piano bar.",
        posSystem: "Toast",
        onlineOrdering: "Toast",
        locationHistory: [
             { period: "1964-Present", name: "The Mews", notes: "Originally a coffee house, evolved into fine dining." }
        ]
    },
    {
        id: generateId("Kung Fu Dumplings", "Provincetown"),
        name: "Kung Fu Dumplings",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Asian",
        price: 2,
        rating: 4.7,
        seasonal: true,
        desc: "Specializes in handmade dumplings and noodles. Authentic street food vibe on Commercial St.",
        posSystem: "Square",
        locationHistory: []
    },
    {
        id: generateId("Sals Place", "Provincetown"),
        name: "Sal's Place",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Italian",
        price: 3,
        rating: 4.5,
        seasonal: true,
        desc: "Historic Italian dining right on the beach in the West End.",
        posSystem: "Toast",
        locationHistory: [
            { period: "1962-Present", name: "Sal's Place", notes: "Started by Sal Del Deo. Famous for artist patronage." }
        ]
    },
    {
        id: generateId("Strangers & Saints", "Provincetown"),
        name: "Strangers & Saints",
        town: "Provincetown",
        region: "Outer Cape",
        type: "Gastropub",
        price: 3,
        rating: 4.7,
        seasonal: true,
        desc: "Trendy Mediterranean tavern with craft cocktails.",
        posSystem: "Toast",
        locationHistory: [
             { period: "2016-Present", name: "Strangers & Saints", notes: "Designed by Ken Fulk." },
             { period: "Previous", name: "Private Home", notes: "Captain's house restoration." }
        ]
    },

    // --- TRURO (Outer Cape) ---
    {
        id: generateId("Blackfish", "Truro"),
        name: "Blackfish",
        town: "Truro",
        region: "Outer Cape",
        type: "Fine Dining",
        price: 4,
        rating: 4.7,
        seasonal: true,
        desc: "Upscale American restaurant in Truro Center. Refined menu.",
        address: "17 Truro Center Rd",
        posSystem: "Aloha",
        locationHistory: [
            { period: "2000s-Present", name: "Blackfish", notes: "Upscale conversion." },
            { period: "1900s", name: "Blacksmith Shop", notes: "Original town blacksmith location." }
        ]
    },
    {
        id: generateId("Truro Vineyards", "Truro"),
        name: "Truro Vineyards (Crush Pad)",
        town: "Truro",
        region: "Outer Cape",
        type: "Casual",
        price: 2,
        rating: 4.6,
        seasonal: true,
        desc: "Winery with a dedicated food truck (Crush Pad) serving upscale snacks.",
        posSystem: "Square",
        locationHistory: [
            { period: "2007-Present", name: "Truro Vineyards", notes: "Roberts family ownership." },
            { period: "1992-2007", name: "Truro Vineyards (Lima)", notes: "First vineyard planting." },
            { period: "1800s", name: "Historic Farmstead", notes: "Former cantaloupe farm." }
        ]
    },
    {
        id: generateId("High Tide Kitchen", "Truro"),
        name: "High Tide Kitchen",
        town: "Truro",
        region: "Outer Cape",
        type: "Asian",
        price: 2,
        rating: 4.8,
        seasonal: true,
        desc: "Asian fusion food truck in North Truro. A critical dining engine for the rural Outer Cape.",
        posSystem: "Square",
        locationHistory: []
    },
    {
        id: generateId("Savory and the Sweet Escape", "Truro"),
        name: "Savory & the Sweet Escape",
        town: "Truro",
        region: "Outer Cape",
        type: "Casual",
        price: 2,
        rating: 4.4,
        seasonal: true,
        desc: "Pizza, bakery, and ice cream spot along Route 6.",
        posSystem: "Toast",
        locationHistory: []
    },

    // --- WELLFLEET (Outer Cape) ---
    {
        id: generateId("The Beachcomber", "Wellfleet"),
        name: "The Beachcomber",
        town: "Wellfleet",
        region: "Outer Cape",
        type: "Bar/Pub",
        price: 2,
        rating: 4.8,
        seasonal: true,
        desc: "Located in the dunes of Cahoon Hollow Beach. Raw bar & live music.",
        address: "1120 Cahoon Hollow Rd, Wellfleet, MA",
        licenseNumber: "WLF-LIQ-001",
        licenseType: "Seasonal",
        seatingCapacity: 200,
        healthScore: 94,
        posSystem: "Aloha",
        onlineOrdering: "None",
        locationHistory: [
             { period: "1978-Present", name: "The Beachcomber", notes: "Converted US Life Saving Station." },
             { period: "1897-1950s", name: "Cahoon Hollow Life Saving Station", notes: "Active US Coast Guard facility saving shipwreck victims." }
        ]
    },
    {
        id: generateId("Macs Shack", "Wellfleet"),
        name: "Mac's Shack",
        town: "Wellfleet",
        region: "Outer Cape",
        type: "Seafood",
        price: 3,
        rating: 4.7,
        seasonal: true,
        desc: "Known for the freshest sushi and oysters on the outer cape.",
        posSystem: "Toast",
        onlineOrdering: "Toast",
        locationHistory: [
            { period: "Present", name: "Mac's Shack", notes: "Part of Mac's Seafood empire." },
            { period: "Previous", name: "Lobster Hutt", notes: "Classic 70s clam shack." }
        ]
    },
    {
        id: generateId("PB Boulangerie", "Wellfleet"),
        name: "PB Boulangerie Bistro",
        town: "Wellfleet",
        region: "Outer Cape",
        type: "Bakery/Bistro",
        price: 3,
        rating: 4.9,
        seasonal: false,
        desc: "French bakery, legendary morning lines for croissants.",
        posSystem: "Upserve",
        onlineOrdering: "Direct",
        website: "https://pbboulangeriebistro.com",
        locationHistory: [
             { period: "2010-Present", name: "PB Boulangerie", notes: "Chef Philippe Rispoli." },
             { period: "Previous", name: "A&W", notes: "Roadside fast food stand." }
        ]
    },
    {
        id: generateId("Pizza Spinello", "Wellfleet"),
        name: "Pizza Spinello",
        town: "Wellfleet",
        region: "Outer Cape",
        type: "Pizza",
        price: 2,
        rating: 4.8,
        seasonal: true,
        desc: "Seasonal, Roman-style pizza (al taglio) in a basement space on Main St. Cult favorite.",
        posSystem: "Toast",
        locationHistory: [
             { period: "2023-Present", name: "Pizza Spinello", notes: "Basement location." },
             { period: "Previous", name: "Various Seasonal Pop-ups", notes: "" }
        ]
    },
    {
        id: generateId("Fox and Crow", "Wellfleet"),
        name: "Fox & Crow Cafe",
        town: "Wellfleet",
        region: "Outer Cape",
        type: "Cafe",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "Community cafe serving as a local gathering point year-round.",
        posSystem: "Square",
        locationHistory: []
    },

    // --- EASTHAM (Outer Cape) ---
    {
        id: generateId("Arnolds", "Eastham"),
        name: "Arnold's Lobster & Clam Bar",
        town: "Eastham",
        region: "Outer Cape",
        type: "Seafood",
        price: 2,
        rating: 4.5,
        seasonal: true,
        desc: "Famous large seafood shack with mini-golf.",
        posSystem: "Micros",
        healthScore: 98,
        locationHistory: [
             { period: "1976-Present", name: "Arnold's", notes: "Expanded significantly in 90s." },
             { period: "Pre-1976", name: "Nickerson's Shell Station", notes: "Automotive service station and snack stand." }
        ]
    },
    {
        id: generateId("Karoo", "Eastham"),
        name: "Karoo",
        town: "Eastham",
        region: "Outer Cape",
        type: "International",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "South African cuisine, unique flavors on the Cape.",
        posSystem: "Toast",
        onlineOrdering: "Toast",
        locationHistory: [
             { period: "Present", name: "Karoo", notes: "Moved to larger location." },
             { period: "Previous", name: "Fairway Pizzeria (partial)", notes: "" }
        ]
    },
    {
        id: generateId("Good Eats on 6", "Eastham"),
        name: "Good Eats on 6",
        town: "Eastham",
        region: "Outer Cape",
        type: "Takeout",
        price: 2,
        rating: 4.4,
        seasonal: false,
        desc: "Roadside spot capturing transient beach traffic with high-quality takeout.",
        posSystem: "Clover",
        locationHistory: []
    },

    // --- ORLEANS (Lower Cape) ---
    {
        id: generateId("Land Ho", "Orleans"),
        name: "Land Ho!",
        town: "Orleans",
        region: "Lower Cape",
        type: "Bar/Pub",
        price: 2,
        rating: 4.4,
        seasonal: false,
        desc: "A true local institution. Hanging signs, pub fare, busy atmosphere.",
        address: "38 Main St, Orleans, MA",
        posSystem: "Aloha",
        licenseType: "Liquor (Full)",
        locationHistory: [
            { period: "1969-Present", name: "Land Ho!", notes: "Founded by the Murphy family. Original signage still hangs." },
            { period: "Pre-1969", name: "News Shop / Retail", notes: "Small commercial storefront." }
        ]
    },
    {
        id: generateId("The Rail", "Orleans"),
        name: "The Rail",
        town: "Orleans",
        region: "Lower Cape",
        type: "Bar/Pub",
        price: 2,
        rating: 4.5,
        seasonal: false,
        desc: "New tavern located in a converted railroad depot. Anchors the dining scene near the bike path.",
        posSystem: "Toast",
        locationHistory: [
            { period: "2022-Present", name: "The Rail", notes: "Modern gastropub conversion." },
            { period: "1900s-1950s", name: "Orleans Railroad Depot", notes: "Active train station for Cape Cod Railroad." }
        ]
    },
    {
        id: generateId("Hole In One", "Orleans"),
        name: "Hole In One",
        town: "Orleans",
        region: "Lower Cape",
        type: "Bakery/Breakfast",
        price: 1,
        rating: 4.7,
        seasonal: false,
        desc: "Famous for hand-cut donuts and hearty breakfasts.",
        posSystem: "Micros",
        locationHistory: []
    },
    {
        id: generateId("Hog Island", "Orleans"),
        name: "Hog Island Beer Co.",
        town: "Orleans",
        region: "Lower Cape",
        type: "Brewery",
        price: 2,
        rating: 4.5,
        seasonal: false,
        desc: "Brewery with outdoor games, food trucks, and local vibes.",
        posSystem: "Toast",
        onlineOrdering: "Toast",
        locationHistory: [
             { period: "2016-Present", name: "Hog Island Beer Co.", notes: "Founded by Mike McNamara." },
             { period: "Previous", name: "Jailhouse Tavern (Rear)", notes: "Part of the Old Jailhouse complex." }
        ]
    },

    // --- CHATHAM (Lower Cape) ---
    {
        id: generateId("Chatham Bars Inn", "Chatham"),
        name: "Chatham Bars Inn (STARS)",
        town: "Chatham",
        region: "Lower Cape",
        type: "Fine Dining",
        price: 4,
        rating: 4.8,
        seasonal: false,
        desc: "Oceanfront luxury, farm-to-table from their own farm.",
        posSystem: "Micros",
        healthScore: 100,
        locationHistory: [
             { period: "1914-Present", name: "Chatham Bars Inn", notes: "Built as a luxury hunting lodge for Boston's elite." }
        ]
    },
    {
        id: generateId("The Squire", "Chatham"),
        name: "The Chatham Squire",
        town: "Chatham",
        region: "Lower Cape",
        type: "Bar/Pub",
        price: 2,
        rating: 4.3,
        seasonal: false,
        desc: "License plates on walls, strong drinks, local legend.",
        address: "487 Main St, Chatham",
        posSystem: "Aloha",
        locationHistory: [
             { period: "1968-Present", name: "The Chatham Squire", notes: "Established by the eclectic duo of Bob & George." },
             { period: "1920s-1960s", name: "Village General Store", notes: "Served as the primary dry goods purveyor." }
        ]
    },
    {
        id: generateId("Bluefins", "Chatham"),
        name: "Bluefins Sushi & Sake Bar",
        town: "Chatham",
        region: "Lower Cape",
        type: "Sushi",
        price: 3,
        rating: 4.7,
        seasonal: false,
        desc: "High-end modern sushi and Asian fusion cuisine.",
        posSystem: "Toast",
        locationHistory: []
    },
    {
        id: generateId("Hangar B", "Chatham"),
        name: "Hangar B Eatery",
        town: "Chatham",
        region: "Lower Cape",
        type: "Breakfast",
        price: 2,
        rating: 4.8,
        seasonal: false,
        desc: "Breakfast and lunch spot located at the Chatham Airport. Locals' favorite.",
        posSystem: "Square",
        locationHistory: []
    },

    // --- BREWSTER (Lower Cape) ---
    {
        id: generateId("Brewster Fish House", "Brewster"),
        name: "Brewster Fish House",
        town: "Brewster",
        region: "Lower Cape",
        type: "Fine Dining",
        price: 3,
        rating: 4.7,
        seasonal: false,
        desc: "Acclaimed upscale seafood restaurant on 6A.",
        posSystem: "Toast",
        locationHistory: [
            { period: "1982-Present", name: "Brewster Fish House", notes: "Evolved from market to fine dining." },
            { period: "1950s", name: "Vernon's Fish Market", notes: "Retail seafood counter." }
        ]
    },
    {
        id: generateId("The Kitchen Cafe", "Brewster"),
        name: "The Kitchen Cafe",
        town: "Brewster",
        region: "Lower Cape",
        type: "Cafe",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "Focuses on healthy, fresh options. Counterpoint to fried fare.",
        posSystem: "Square",
        locationHistory: []
    },
    {
        id: generateId("The Woodshed", "Brewster"),
        name: "The Woodshed",
        town: "Brewster",
        region: "Lower Cape",
        type: "Bar/Pub",
        price: 2,
        rating: 4.3,
        seasonal: true,
        desc: "Rustic bar/venue, famous dive bar atmosphere.",
        posSystem: "Aloha",
        locationHistory: [
             { period: "1970s-Present", name: "The Woodshed", notes: "Legendary live music venue." }
        ]
    },

    // --- HARWICH (Lower Cape) ---
    {
        id: generateId("The Port", "Harwich"),
        name: "The Port",
        town: "Harwich",
        region: "Lower Cape",
        type: "Fine Dining",
        price: 3,
        rating: 4.5,
        seasonal: true,
        desc: "Oyster bar and upscale dinner, lively bar scene.",
        posSystem: "Toast",
        locationHistory: []
    },
    {
        id: generateId("Scribanos", "Harwich"),
        name: "Scribano's Italian Market",
        town: "Harwich",
        region: "Lower Cape",
        type: "Deli",
        price: 2,
        rating: 4.8,
        seasonal: false,
        desc: "The only source for 'real' Italian subs on the Lower Cape. Import market and lunch counter.",
        posSystem: "Clover",
        locationHistory: []
    },
    {
        id: generateId("The Mad Minnow", "Harwich"),
        name: "The Mad Minnow",
        town: "Harwich",
        region: "Lower Cape",
        type: "Gastropub",
        price: 2,
        rating: 4.6,
        seasonal: true,
        desc: "Gastropub with a beer garden vibe in Harwich Port.",
        posSystem: "Toast",
        locationHistory: []
    },

    // --- DENNIS (Mid Cape) ---
    {
        id: generateId("Sesuit Harbor Cafe", "Dennis"),
        name: "Sesuit Harbor Cafe",
        town: "Dennis",
        region: "Mid Cape",
        type: "Seafood",
        price: 2,
        rating: 4.8,
        seasonal: true,
        desc: "Famous lobster rolls, outdoor seating only, BYOB, sunset views.",
        address: "357 Sesuit Neck Rd, Dennis",
        posSystem: "Square",
        licenseType: "Common Victualler",
        locationHistory: [
             { period: "2000-Present", name: "Sesuit Harbor Cafe", notes: "Current ownership." },
             { period: "1900s", name: "Municipal Boat Yard", notes: "Site was strictly industrial." }
        ]
    },
    {
        id: generateId("The Doghouse", "Dennis"),
        name: "The Doghouse",
        town: "Dennis",
        region: "Mid Cape",
        type: "Fast Casual",
        price: 1,
        rating: 4.7,
        seasonal: true,
        desc: "Dennis Port institution. Hot dog stand known for frosé and tater tot mountains.",
        posSystem: "Toast",
        locationHistory: []
    },
    {
        id: generateId("Lune", "Dennis"),
        name: "Lune",
        town: "Dennis",
        region: "Mid Cape",
        type: "Fine Dining",
        price: 4,
        rating: 4.9,
        seasonal: false,
        desc: "Modern dining with tasting menus. Semi-finalist for Best New Restaurant 2025 (James Beard).",
        posSystem: "Toast",
        locationHistory: [
             { period: "2024-Present", name: "Lune", notes: "Opened by Chef ... (Simulated)" },
             { period: "Previous", name: "The Red Pheasant (Relocated)", notes: "" }
        ]
    },

    // --- YARMOUTH (Mid Cape) ---
    {
        id: generateId("Skipper Chowder House", "Yarmouth"),
        name: "Skipper Chowder House",
        town: "Yarmouth",
        region: "Mid Cape",
        type: "Seafood",
        price: 2,
        rating: 4.4,
        seasonal: true,
        desc: "Established 1936. Triple crown chowder winner.",
        posSystem: "Aloha",
        locationHistory: [
             { period: "1936-Present", name: "Skipper Chowder House", notes: "One of the oldest restaurants on the Cape." }
        ]
    },
    {
        id: generateId("Keltic Kitchen", "Yarmouth"),
        name: "Keltic Kitchen",
        town: "Yarmouth",
        region: "Mid Cape",
        type: "Breakfast",
        price: 2,
        rating: 4.8,
        seasonal: false,
        desc: "Beloved breakfast/brunch spot known for traditional Irish breakfast.",
        posSystem: "Micros",
        locationHistory: []
    },
    {
        id: generateId("Inaho", "Yarmouth"),
        name: "Inaho",
        town: "Yarmouth",
        region: "Mid Cape",
        type: "Sushi",
        price: 3,
        rating: 4.7,
        seasonal: false,
        desc: "High-end Japanese/Sushi in a historic building in Yarmouth Port.",
        posSystem: "Micros",
        locationHistory: []
    },

    // --- BARNSTABLE / HYANNIS (Mid Cape) ---
    {
        id: generateId("Black Cat Tavern", "Hyannis"),
        name: "Black Cat Tavern",
        town: "Hyannis",
        region: "Mid Cape",
        type: "Seafood",
        price: 3,
        rating: 4.4,
        seasonal: false,
        desc: "Right on the harbor, huge patio, jazz brunch.",
        posSystem: "Aloha",
        locationHistory: []
    },
    {
        id: generateId("Karibbean Lounge", "Hyannis"),
        name: "The Karibbean Lounge",
        town: "Hyannis",
        region: "Mid Cape",
        type: "International",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "Authentic Caribbean full-service restaurant. Jerk chicken, goat curry, oxtail.",
        posSystem: "Clover",
        locationHistory: []
    },
    {
        id: generateId("Spoon and Seed", "Hyannis"),
        name: "Spoon and Seed",
        town: "Hyannis",
        region: "Mid Cape",
        type: "Breakfast",
        price: 2,
        rating: 4.7,
        seasonal: false,
        desc: "Farm-to-table breakfast and brunch spot.",
        posSystem: "Toast",
        locationHistory: [
             { period: "2015-Present", name: "Spoon and Seed", notes: "Located in the hidden industrial park." }
        ]
    },
    {
        id: generateId("Pizza Barbone", "Hyannis"),
        name: "Pizza Barbone",
        town: "Hyannis",
        region: "Mid Cape",
        type: "Pizza",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "Wood-fired pizza with rooftop gardening. Authentic Neapolitan style.",
        posSystem: "Toast",
        locationHistory: []
    },
    {
        id: generateId("Albertos", "Hyannis"),
        name: "Alberto's Ristorante",
        town: "Hyannis",
        region: "Mid Cape",
        type: "Italian",
        price: 3,
        rating: 4.5,
        seasonal: false,
        desc: "Formal Northern Italian dining. A Hyannis staple.",
        posSystem: "Micros",
        locationHistory: [
             { period: "1984-Present", name: "Alberto's", notes: "Long-standing Italian tradition." }
        ]
    },

    // --- MASHPEE (Upper Cape) ---
    {
        id: generateId("Siena", "Mashpee"),
        name: "Siena",
        town: "Mashpee",
        region: "Upper Cape",
        type: "Italian",
        price: 2,
        rating: 4.3,
        seasonal: false,
        desc: "Italian trattoria in Mashpee Commons.",
        posSystem: "Micros",
        locationHistory: []
    },
    {
        id: generateId("Trevi Cafe", "Mashpee"),
        name: "Trevi Café & Wine Bar",
        town: "Mashpee",
        region: "Upper Cape",
        type: "Wine Bar",
        price: 3,
        rating: 4.6,
        seasonal: false,
        desc: "European-style cafe with an extensive wine list and small plates.",
        posSystem: "Aloha",
        locationHistory: []
    },
    {
        id: generateId("Polar Cave", "Mashpee"),
        name: "Polar Cave Ice Cream",
        town: "Mashpee",
        region: "Upper Cape",
        type: "Ice Cream",
        price: 1,
        rating: 4.8,
        seasonal: true,
        desc: "Legendary shop known for made-to-order waffle cones.",
        posSystem: "Clover",
        locationHistory: []
    },

    // --- FALMOUTH (Upper Cape) ---
    {
        id: generateId("Quarterdeck", "Falmouth"),
        name: "The Quarterdeck",
        town: "Falmouth",
        region: "Upper Cape",
        type: "Seafood",
        price: 2,
        rating: 4.5,
        seasonal: false,
        desc: "Historic vibe, reclaimed wood interior, Main St staple.",
        posSystem: "Aloha",
        locationHistory: [
            { period: "1967-Present", name: "The Quarterdeck", notes: "Decor includes salvage from local shipwrecks." }
        ]
    },
    {
        id: generateId("Maison Villatte", "Falmouth"),
        name: "Maison Villatte",
        town: "Falmouth",
        region: "Upper Cape",
        type: "Bakery",
        price: 2,
        rating: 4.9,
        seasonal: false,
        desc: "Highly regarded French bakery providing authentic pastries and breads.",
        posSystem: "Square",
        locationHistory: []
    },
    {
        id: generateId("The Glass Onion", "Falmouth"),
        name: "The Glass Onion",
        town: "Falmouth",
        region: "Upper Cape",
        type: "Fine Dining",
        price: 4,
        rating: 4.7,
        seasonal: false,
        desc: "Refined American cuisine in an intimate setting on North Main St.",
        posSystem: "Toast",
        locationHistory: []
    },
    {
        id: generateId("Pickle Jar Kitchen", "Falmouth"),
        name: "Pickle Jar Kitchen",
        town: "Falmouth",
        region: "Upper Cape",
        type: "Breakfast",
        price: 2,
        rating: 4.7,
        seasonal: false,
        desc: "Popular breakfast and lunch spot emphasizing wholesome ingredients.",
        posSystem: "Toast",
        locationHistory: []
    },

    // --- SANDWICH (Upper Cape) ---
    {
        id: generateId("Fishermens View", "Sandwich"),
        name: "Fishermen's View",
        town: "Sandwich",
        region: "Upper Cape",
        type: "Seafood",
        price: 3,
        rating: 4.6,
        seasonal: false,
        desc: "Located at the marina, boat-to-table, sushi and seafood.",
        posSystem: "Toast",
        locationHistory: [
             { period: "2016-Present", name: "Fishermen's View", notes: "New construction on industrial marina lot." }
        ]
    },
    {
        id: generateId("Marshland", "Sandwich"),
        name: "Marshland Restaurant",
        town: "Sandwich",
        region: "Upper Cape",
        type: "Diner",
        price: 1,
        rating: 4.5,
        seasonal: false,
        desc: "Local institution famous for its comfort food and bakery (stuffed quahogs).",
        posSystem: "Micros",
        locationHistory: []
    },
    {
        id: generateId("Off the Grid", "Sandwich"),
        name: "Off the Grid",
        town: "Sandwich",
        region: "Upper Cape",
        type: "BBQ",
        price: 2,
        rating: 4.6,
        seasonal: false,
        desc: "BBQ and craft beer spot adding a modern, casual trend.",
        posSystem: "Square",
        locationHistory: []
    },

    // --- BOURNE (Upper Cape) ---
    {
        id: generateId("Mezza Luna", "Bourne"),
        name: "Mezza-Luna Restaurant",
        town: "Bourne",
        region: "Upper Cape",
        type: "Italian",
        price: 2,
        rating: 4.4,
        seasonal: false,
        desc: "Classic Italian restaurant in Buzzards Bay.",
        posSystem: "Micros",
        locationHistory: [
             { period: "1937-Present", name: "Mezza Luna", notes: "Founded by E.J. Cubellis." }
        ]
    },
    {
        id: generateId("East Wind Lobster", "Bourne"),
        name: "East Wind Lobster & Grille",
        town: "Bourne",
        region: "Upper Cape",
        type: "Seafood",
        price: 2,
        rating: 4.5,
        seasonal: true,
        desc: "Seafood market & eatery at Buzzards Bay Marina. Boat-to-table.",
        posSystem: "Aloha",
        locationHistory: []
    },
    {
        id: generateId("Mics Main Scoop", "Bourne"),
        name: "Mic's Main Scoop",
        town: "Bourne",
        region: "Upper Cape",
        type: "Ice Cream",
        price: 1,
        rating: 4.6,
        seasonal: true,
        desc: "Community-focused ice cream parlor in Buzzards Bay.",
        posSystem: "Clover",
        locationHistory: []
    },
    {
        id: generateId("Stir Crazy", "Bourne"),
        name: "Stir Crazy",
        town: "Bourne",
        region: "Upper Cape",
        type: "Asian",
        price: 2,
        rating: 4.5,
        seasonal: false,
        desc: "Cambodian-influenced menu. Lock Lack beef and fresh maki rolls.",
        posSystem: "Toast",
        locationHistory: []
    }
];