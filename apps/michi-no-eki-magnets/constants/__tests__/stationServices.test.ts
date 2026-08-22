import { stationHasServices } from '../../constants/stationServices';

describe('stationHasServices', () => {
  it('returns true when no services are required', () => {
    expect(stationHasServices(['shop'], [])).toBe(true);
  });

  it('requires all selected services to be present', () => {
    expect(stationHasServices(['shop', 'wifi'], ['shop'])).toBe(true);
    expect(stationHasServices(['shop'], ['shop', 'wifi'])).toBe(false);
  });
});
