import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSameRoutePoint,
  parseDurationSeconds,
} from './googleRoutes.ts';

describe('parseDurationSeconds', () => {
  it('parses integer seconds', () => {
    assert.equal(parseDurationSeconds('3723s'), 3723);
  });

  it('rounds fractional seconds', () => {
    assert.equal(parseDurationSeconds('12.6s'), 13);
  });

  it('returns null for bad input', () => {
    assert.equal(parseDurationSeconds(undefined), null);
    assert.equal(parseDurationSeconds('PT1H'), null);
  });
});

describe('isSameRoutePoint', () => {
  it('treats near-identical coords as same', () => {
    assert.equal(
      isSameRoutePoint(
        { latitude: 33.24, longitude: 131.61 },
        { latitude: 33.2400001, longitude: 131.6100001 },
      ),
      true,
    );
  });

  it('detects different points', () => {
    assert.equal(
      isSameRoutePoint(
        { latitude: 33.24, longitude: 131.61 },
        { latitude: 33.59, longitude: 130.42 },
      ),
      false,
    );
  });
});
