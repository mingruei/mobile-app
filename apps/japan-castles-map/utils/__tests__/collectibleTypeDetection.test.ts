import { detectCollectibleKind } from '../collectibleTypeDetection';

describe('detectCollectibleKind', () => {
  it('detects square images as meijo-stamp', () => {
    expect(detectCollectibleKind({ width: 1000, height: 1000 })).toEqual({
      kind: 'meijo-stamp',
      confidence: 'high',
    });
    expect(detectCollectibleKind({ width: 1020, height: 1000 })).toEqual({
      kind: 'meijo-stamp',
      confidence: 'high',
    });
  });

  it('detects landscape images as castle-card', () => {
    expect(detectCollectibleKind({ width: 1600, height: 900 })).toEqual({
      kind: 'castle-card',
      confidence: 'high',
    });
  });

  it('detects portrait images as goshuin', () => {
    expect(detectCollectibleKind({ width: 900, height: 1600 })).toEqual({
      kind: 'goshuin',
      confidence: 'high',
    });
  });

  it('returns low-confidence goshuin for invalid dimensions', () => {
    expect(detectCollectibleKind({ width: 0, height: 100 })).toEqual({
      kind: 'goshuin',
      confidence: 'low',
    });
    expect(detectCollectibleKind({ width: 100, height: -1 })).toEqual({
      kind: 'goshuin',
      confidence: 'low',
    });
  });
});
