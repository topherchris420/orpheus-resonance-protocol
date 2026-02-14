import { describe, expect, test } from 'bun:test';
import { RealisticDataGenerator } from './realisticData';

describe('RealisticDataGenerator', () => {
  test('caps intel feed history at 10 entries', () => {
    const generator = new RealisticDataGenerator();

    for (let i = 0; i < 12; i += 1) {
      generator.generateIntelUpdate(4);
    }

    const feed = generator.getIntelFeed();
    expect(feed).toHaveLength(10);
    expect(feed[0].id).toBe('intel-3');
    expect(feed[9].id).toBe('intel-12');
  });

  test('never returns clearance level above the requested level', () => {
    const generator = new RealisticDataGenerator();

    for (let i = 0; i < 100; i += 1) {
      const intel = generator.generateIntelUpdate(2);
      expect(intel.clearanceLevel).toBeGreaterThanOrEqual(1);
      expect(intel.clearanceLevel).toBeLessThanOrEqual(2);
    }
  });

  test('generates threat indicators in expected bounds', () => {
    const generator = new RealisticDataGenerator();
    const threats = generator.generateThreatIndicators(6);

    expect(threats).toHaveLength(6);
    for (const threat of threats) {
      expect(threat.position.x).toBeGreaterThanOrEqual(10);
      expect(threat.position.x).toBeLessThanOrEqual(389);
      expect(threat.position.y).toBeGreaterThanOrEqual(10);
      expect(threat.position.y).toBeLessThanOrEqual(389);
      expect(threat.confidence).toBeGreaterThanOrEqual(60);
      expect(threat.confidence).toBeLessThanOrEqual(99);
    }
  });
});
