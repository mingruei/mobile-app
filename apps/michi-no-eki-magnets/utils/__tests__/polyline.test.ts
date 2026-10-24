import { decodeEncodedPolyline } from '../polyline';

describe('decodeEncodedPolyline', () => {
  it('decodes a known Google example polyline', () => {
    const points = decodeEncodedPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');

    expect(points.length).toBeGreaterThan(1);
    expect(points[0]?.latitude).toBeCloseTo(38.5, 1);
    expect(points[0]?.longitude).toBeCloseTo(-120.2, 1);
  });
});
