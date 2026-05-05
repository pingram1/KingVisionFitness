/**
 * Minimal smoke — validates Jest wiring in CI. Add ts-jest + TS specs when exercising routes/models.
 */

describe('KingVision Fitness API (smoke)', () => {
  it('jest pipeline is wired', () => {
    expect(true).toBe(true);
  });
});
