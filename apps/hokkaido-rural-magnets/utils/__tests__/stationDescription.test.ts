import { createStation } from './fixtures';
import { getStationShortDescription } from '../stationDescription';

describe('getStationShortDescription', () => {
  it('prefers Traditional Chinese description when available', () => {
    const station = createStation({
      shortDescription: '丘のまち びえい',
      shortDescriptionZh: '丘陵之町 美瑛',
    });

    expect(getStationShortDescription(station)).toBe('丘陵之町 美瑛');
  });

  it('falls back to Japanese description when Chinese is missing', () => {
    const station = createStation({
      shortDescription: '丘のまち びえい',
      shortDescriptionZh: null,
    });

    expect(getStationShortDescription(station)).toBe('丘のまち びえい');
  });

  it('returns null when no description is available', () => {
    const station = createStation({
      shortDescription: null,
      shortDescriptionZh: null,
    });

    expect(getStationShortDescription(station)).toBeNull();
  });
});
