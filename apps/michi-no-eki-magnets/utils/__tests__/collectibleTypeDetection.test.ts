import { detectCollectibleKind } from '../collectibleTypeDetection';

describe('detectCollectibleKind', () => {
  it('detects square images as magnet', () => {
    expect(detectCollectibleKind({ width: 1000, height: 1000 })).toEqual({
      kind: 'magnet',
      confidence: 'high',
    });
    expect(detectCollectibleKind({ width: 1020, height: 1000 })).toEqual({
      kind: 'magnet',
      confidence: 'high',
    });
  });

  it('detects landscape images as magnet', () => {
    expect(detectCollectibleKind({ width: 1600, height: 900 })).toEqual({
      kind: 'magnet',
      confidence: 'high',
    });
  });

  it('detects portrait images as magnet', () => {
    expect(detectCollectibleKind({ width: 900, height: 1600 })).toEqual({
      kind: 'magnet',
      confidence: 'high',
    });
  });

  it('returns low-confidence magnet for invalid dimensions', () => {
    expect(detectCollectibleKind({ width: 0, height: 100 })).toEqual({
      kind: 'magnet',
      confidence: 'low',
    });
    expect(detectCollectibleKind({ width: 100, height: -1 })).toEqual({
      kind: 'magnet',
      confidence: 'low',
    });
  });
});
