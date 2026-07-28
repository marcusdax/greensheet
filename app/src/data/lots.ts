export interface CoffeeLot {
  id: string;
  origin: string;
  varietal?: string;
  processingMethod: 'washed' | 'natural' | 'honey' | 'anaerobic';
  elevation: number;
  cupScore: number;
  pricePerLb: number;
  costPerLb: number;
  availableQuantityLbs: number;
  totalProductionLbs: number;
  esgScore?: number;
  fairTradeCertified?: boolean;
  organicCertified?: boolean;
  rainforestAlliance?: boolean;
  flavorNotes?: string[];
  sensoryProfile?: { acidity: number; body: number; sweetness: number };
  estimatedArrival?: string;
  lastUpdatedAt: string;
}

export const lots: CoffeeLot[] = [
  {
    id: 'lot_001',
    origin: 'Huila, Colombia',
    varietal: 'Pink Bourbon',
    processingMethod: 'washed',
    elevation: 1750,
    cupScore: 88.5,
    pricePerLb: 6.10,
    costPerLb: 4.45,
    availableQuantityLbs: 2640,
    totalProductionLbs: 6600,
    esgScore: 0.82,
    organicCertified: true,
    flavorNotes: ['jasmine', 'cane sugar', 'red currant', 'cocoa nib', 'lime'],
    sensoryProfile: { acidity: 8.5, body: 7.0, sweetness: 8.8 },
    estimatedArrival: '2025-07-12',
    lastUpdatedAt: new Date(Date.now() - 5*864e5).toISOString()
  },
  {
    id: 'lot_002',
    origin: 'Yirgacheffe, Ethiopia',
    varietal: 'Heirloom',
    processingMethod: 'natural',
    elevation: 2100,
    cupScore: 87.0,
    pricePerLb: 5.75,
    costPerLb: 4.10,
    availableQuantityLbs: 1320,
    totalProductionLbs: 4400,
    esgScore: 0.78,
    fairTradeCertified: true,
    flavorNotes: ['blueberry', 'bergamot', 'cacao', 'lavender'],
    sensoryProfile: { acidity: 8.8, body: 7.5, sweetness: 8.4 },
    estimatedArrival: '2025-06-28',
    lastUpdatedAt: new Date(Date.now() - 16*864e5).toISOString()
  },
  {
    id: 'lot_003',
    origin: 'Tarrazú, Costa Rica',
    varietal: 'Caturra',
    processingMethod: 'honey',
    elevation: 1850,
    cupScore: 86.5,
    pricePerLb: 5.20,
    costPerLb: 3.80,
    availableQuantityLbs: 3960,
    totalProductionLbs: 8800,
    esgScore: 0.85,
    rainforestAlliance: true,
    flavorNotes: ['chocolate', 'orange zest', 'panela', 'almond', 'vanilla', 'black tea'],
    sensoryProfile: { acidity: 7.8, body: 8.0, sweetness: 8.6 },
    estimatedArrival: '2025-06-30',
    lastUpdatedAt: new Date(Date.now() - 3*864e5).toISOString()
  },
  {
    id: 'lot_004',
    origin: 'Nyeri, Kenya',
    varietal: 'SL28',
    processingMethod: 'washed',
    elevation: 1900,
    cupScore: 90.5,
    pricePerLb: 9.80,
    costPerLb: 7.20,
    availableQuantityLbs: 880,
    totalProductionLbs: 2200,
    esgScore: 0.74,
    flavorNotes: ['blackcurrant', 'grapefruit', 'brown sugar', 'tomato leaf'],
    sensoryProfile: { acidity: 9.2, body: 7.8, sweetness: 8.9 },
    estimatedArrival: '2025-08-03',
    lastUpdatedAt: new Date(Date.now() - 2*864e5).toISOString()
  },
  {
    id: 'lot_005',
    origin: 'Cajamarca, Peru',
    varietal: 'Bourbon',
    processingMethod: 'anaerobic',
    elevation: 1950,
    cupScore: 84.0,
    pricePerLb: 4.60,
    costPerLb: 3.30,
    availableQuantityLbs: 0,
    totalProductionLbs: 3300,
    esgScore: 0.88,
    organicCertified: true,
    flavorNotes: ['rum raisin', 'pineapple', 'cinnamon'],
    sensoryProfile: { acidity: 8.2, body: 7.2, sweetness: 8.0 },
    estimatedArrival: '2025-07-20',
    lastUpdatedAt: new Date(Date.now() - 30*864e5).toISOString()
  },
];
