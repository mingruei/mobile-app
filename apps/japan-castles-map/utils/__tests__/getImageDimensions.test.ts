import { Image } from 'react-native';

import { resolveSelectionDimensions } from '../getImageDimensions';

describe('resolveSelectionDimensions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns dimensions from the selection when present', async () => {
    await expect(
      resolveSelectionDimensions({
        uri: 'file:///photo.jpg',
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
      }),
    ).resolves.toEqual({ width: 800, height: 600 });
  });

  it('reads dimensions from Image.getSize when missing', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
      success(640, 480);
    });

    await expect(
      resolveSelectionDimensions({
        uri: 'file:///photo.jpg',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toEqual({ width: 640, height: 480 });
  });

  it('falls back to default dimensions when reads fail', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, _success, failure) => {
      failure(new Error('failed'));
    });

    await expect(
      resolveSelectionDimensions({
        uri: 'file:///missing.jpg',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toEqual({ width: 630, height: 880 });
  });
});
