// Realistic data generators for the tactical simulation

export interface IntelUpdate {
  id: string;
  timestamp: number;
  message: string;
  clearanceLevel: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
}

export interface ThreatIndicator {
  id: string;
  position: { x: number; y: number };
  type: 'hostile' | 'unknown' | 'friendly';
  confidence: number;
  lastUpdated: number;
}

export interface SquadMember {
  id: string;
  callSign: string;
  position: { x: number; y: number };
  status: 'active' | 'wounded' | 'kia' | 'offline';
  vitals: {
    heartRate: number;
    oxygenSat: number;
    bodyTemp: number;
  };
}

// Realistic intel messages based on military operations
const INTEL_TEMPLATES = [
  "Drone surveillance confirms {count} hostiles at grid {grid}",
  "Intercepted radio chatter suggests imminent movement from {location}",
  "Civilian evacuation complete from sectors {sectors}",
  "Supply convoy ETA {time} minutes to checkpoint Alpha",
  "Weather update: Visibility dropping to {visibility}m due to {condition}",
  "Intel asset reports vehicle movement along Route {route}",
  "Satellite imagery shows potential IED placement at {location}",
  "Friendly forces advancing on objective {objective}",
  "Medical evacuation requested at grid {grid}",
  "Communication interference detected on frequency {freq} MHz",
  "Patrol Alpha-{number} reports all clear in sector {sector}",
  "Unknown aircraft detected bearing {bearing} degrees",
  "Local national reports suspicious activity near {landmark}",
  "Resupply drop confirmed for LZ {zone} at {time}",
  "Electronic warfare detected - recommend frequency change"
];

const LOCATIONS = ["Building 47", "Overpass Delta", "Market Square", "Industrial Complex", "Riverside"];
const ROUTES = ["Phoenix", "Viper", "Eagle", "Falcon", "Hawk"];
const GRIDS = ["334521", "445632", "556743", "667854", "778965"];
const SECTORS = ["A-7", "B-3", "C-9", "D-5", "E-1"];
const WEATHER_CONDITIONS = ["sandstorm", "fog", "rain", "dust clouds"];

export class RealisticDataGenerator {
  private lastIntelId = 0;
  private lastThreatId = 0;
  private intelHistory: IntelUpdate[] = [];

  generateIntelUpdate(clearanceLevel: number = 1): IntelUpdate {
    const template = INTEL_TEMPLATES[Math.floor(Math.random() * INTEL_TEMPLATES.length)];
    const priority = Math.random() > 0.7 ? 'HIGH' : Math.random() > 0.4 ? 'MEDIUM' : 'LOW';
    
    let message = template
      .replace('{count}', String(Math.floor(Math.random() * 8) + 2))
      .replace('{grid}', GRIDS[Math.floor(Math.random() * GRIDS.length)])
      .replace('{location}', LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)])
      .replace('{sectors}', `${SECTORS[Math.floor(Math.random() * SECTORS.length)]}, ${SECTORS[Math.floor(Math.random() * SECTORS.length)]}`)
      .replace('{time}', String(Math.floor(Math.random() * 30) + 5))
      .replace('{visibility}', String(Math.floor(Math.random() * 200) + 50))
      .replace('{condition}', WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)])
      .replace('{route}', ROUTES[Math.floor(Math.random() * ROUTES.length)])
      .replace('{objective}', `OBJ-${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`)
      .replace('{freq}', String(Math.floor(Math.random() * 100) + 400))
      .replace('{number}', String(Math.floor(Math.random() * 9) + 1))
      .replace('{sector}', SECTORS[Math.floor(Math.random() * SECTORS.length)])
      .replace('{bearing}', String(Math.floor(Math.random() * 360)))
      .replace('{landmark}', LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)])
      .replace('{zone}', `LZ-${String.fromCharCode(65 + Math.floor(Math.random() * 5))}`);

    const intel: IntelUpdate = {
      id: `intel-${++this.lastIntelId}`,
      timestamp: Date.now(),
      message,
      clearanceLevel: Math.min(clearanceLevel, Math.floor(Math.random() * 4) + 1),
      priority,
      source: ['SIGINT', 'HUMINT', 'IMINT', 'OSINT', 'FIELD'][Math.floor(Math.random() * 5)]
    };

    this.intelHistory.push(intel);
    if (this.intelHistory.length > 10) {
      this.intelHistory = this.intelHistory.slice(-10);
    }

    return intel;
  }

  getIntelFeed(): IntelUpdate[] {
    return [...this.intelHistory];
  }

  generateThreatIndicators(count: number = 3): ThreatIndicator[] {
    const threats: ThreatIndicator[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = Math.random() > 0.6 ? 'hostile' : Math.random() > 0.3 ? 'unknown' : 'friendly';
      threats.push({
        id: `threat-${++this.lastThreatId}`,
        position: {
          x: Math.floor(Math.random() * 380) + 10,
          y: Math.floor(Math.random() * 380) + 10
        },
        type,
        confidence: Math.floor(Math.random() * 40) + 60,
        lastUpdated: Date.now() - Math.floor(Math.random() * 300000) // Updated within last 5 minutes
      });
    }
    
    return threats;
  }

  generateSquadPositions(count: number = 4): SquadMember[] {
    const callSigns = ['Alpha-1', 'Bravo-2', 'Charlie-3', 'Delta-4', 'Echo-5'];
    const squad: SquadMember[] = [];
    
    for (let i = 0; i < count; i++) {
      const status = Math.random() > 0.9 ? 'wounded' : Math.random() > 0.98 ? 'offline' : 'active';
      squad.push({
        id: `member-${i + 1}`,
        callSign: callSigns[i],
        position: {
          x: Math.floor(Math.random() * 300) + 50,
          y: Math.floor(Math.random() * 300) + 50
        },
        status,
        vitals: {
          heartRate: Math.floor(Math.random() * 40) + 70, // 70-110 bpm
          oxygenSat: Math.floor(Math.random() * 5) + 95, // 95-100%
          bodyTemp: Math.floor(Math.random() * 20) + 970 / 10 // 97.0-99.0°F
        }
      });
    }
    
    return squad;
  }

  generateOptimalPath(): Array<{ x: number; y: number }> {
    const path = [];
    let currentX = 50;
    let currentY = 50;
    
    // Generate a realistic tactical path avoiding potential threat areas
    for (let i = 0; i < 8; i++) {
      currentX += Math.floor(Math.random() * 60) - 30;
      currentY += Math.floor(Math.random() * 60) - 30;
      
      // Keep within bounds
      currentX = Math.max(20, Math.min(380, currentX));
      currentY = Math.max(20, Math.min(380, currentY));
      
      path.push({ x: currentX, y: currentY });
    }
    
    return path;
  }

  generateRealisticVitals(baseHrv: number, baseRespRate: number, stressLevel: number) {
    // Add realistic variability to vitals based on stress and time
    const timeVariation = Math.sin(Date.now() / 10000) * 0.1;
    const randomVariation = (Math.random() - 0.5) * 0.2;
    
    return {
      hrv: Math.max(20, baseHrv + (stressLevel * -30) + (timeVariation * 10) + (randomVariation * 5)),
      respiratoryRate: Math.max(8, baseRespRate + (stressLevel * 8) + (timeVariation * 2) + (randomVariation * 1)),
      cognitiveStressIndex: Math.min(1, Math.max(0, stressLevel + (timeVariation * 0.1) + (randomVariation * 0.05)))
    };
  }
}

export const dataGenerator = new RealisticDataGenerator();
