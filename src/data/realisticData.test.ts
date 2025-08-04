import { describe, it, expect, beforeEach } from 'vitest';
import { RealisticDataGenerator, IntelUpdate, ThreatIndicator, SquadMember } from './realisticData';

describe('RealisticDataGenerator', () => {
  let dataGenerator: RealisticDataGenerator;

  beforeEach(() => {
    dataGenerator = new RealisticDataGenerator();
  });

  describe('generateIntelUpdate', () => {
    it('should generate a valid intel update', () => {
      const intel = dataGenerator.generateIntelUpdate();
      expect(intel).toBeDefined();
      expect(typeof intel.id).toBe('string');
      expect(typeof intel.timestamp).toBe('number');
      expect(typeof intel.message).toBe('string');
      expect(typeof intel.clearanceLevel).toBe('number');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(intel.priority);
      expect(typeof intel.source).toBe('string');
    });

    it('should respect the clearance level', () => {
      const intel = dataGenerator.generateIntelUpdate(1);
      expect(intel.clearanceLevel).toBeLessThanOrEqual(1);
    });
  });

  describe('getIntelFeed', () => {
    it('should return the history of intel updates', () => {
      dataGenerator.generateIntelUpdate();
      dataGenerator.generateIntelUpdate();
      const feed = dataGenerator.getIntelFeed();
      expect(Array.isArray(feed)).toBe(true);
      expect(feed.length).toBe(2);
    });
  });

  describe('generateThreatIndicators', () => {
    it('should generate the specified number of threat indicators', () => {
      const threats = dataGenerator.generateThreatIndicators(5);
      expect(threats.length).toBe(5);
    });

    it('should generate valid threat indicators', () => {
      const threats = dataGenerator.generateThreatIndicators(1);
      const threat = threats[0];
      expect(threat).toBeDefined();
      expect(typeof threat.id).toBe('string');
      expect(typeof threat.position.x).toBe('number');
      expect(typeof threat.position.y).toBe('number');
      expect(['hostile', 'unknown', 'friendly']).toContain(threat.type);
      expect(typeof threat.confidence).toBe('number');
      expect(typeof threat.lastUpdated).toBe('number');
    });
  });

  describe('generateSquadPositions', () => {
    it('should generate the specified number of squad members', () => {
      const squad = dataGenerator.generateSquadPositions(4);
      expect(squad.length).toBe(4);
    });

    it('should generate valid squad members', () => {
      const squad = dataGenerator.generateSquadPositions(1);
      const member = squad[0];
      expect(member).toBeDefined();
      expect(typeof member.id).toBe('string');
      expect(typeof member.callSign).toBe('string');
      expect(typeof member.position.x).toBe('number');
      expect(typeof member.position.y).toBe('number');
      expect(['active', 'wounded', 'kia', 'offline']).toContain(member.status);
      expect(typeof member.vitals.heartRate).toBe('number');
      expect(typeof member.vitals.oxygenSat).toBe('number');
      expect(typeof member.vitals.bodyTemp).toBe('number');
    });
  });

  describe('generateOptimalPath', () => {
    it('should generate a path with 8 points', () => {
      const path = dataGenerator.generateOptimalPath();
      expect(path.length).toBe(8);
    });

    it('should generate a path of valid points', () => {
      const path = dataGenerator.generateOptimalPath();
      path.forEach(point => {
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
        expect(point.x).toBeGreaterThanOrEqual(20);
        expect(point.x).toBeLessThanOrEqual(380);
        expect(point.y).toBeGreaterThanOrEqual(20);
        expect(point.y).toBeLessThanOrEqual(380);
      });
    });
  });

  describe('generateRealisticVitals', () => {
    it('should generate valid vitals', () => {
      const vitals = dataGenerator.generateRealisticVitals(78, 16.2, 0.5);
      expect(vitals).toBeDefined();
      expect(typeof vitals.hrv).toBe('number');
      expect(typeof vitals.respiratoryRate).toBe('number');
      expect(typeof vitals.cognitiveStressIndex).toBe('number');
    });

    it('should reflect stress level in vitals', () => {
      const lowStressVitals = dataGenerator.generateRealisticVitals(78, 16.2, 0.1);
      const highStressVitals = dataGenerator.generateRealisticVitals(78, 16.2, 0.9);

      expect(highStressVitals.hrv).toBeLessThan(lowStressVitals.hrv);
      expect(highStressVitals.respiratoryRate).toBeGreaterThan(lowStressVitals.respiratoryRate);
      expect(highStressVitals.cognitiveStressIndex).toBeGreaterThan(lowStressVitals.cognitiveStressIndex);
    });
  });
});
