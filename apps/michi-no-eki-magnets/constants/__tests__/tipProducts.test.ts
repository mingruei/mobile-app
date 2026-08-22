import { TIP_PRODUCT_IDS, TIP_SMALL_PRODUCT_ID } from '../tipProducts';

describe('tipProducts', () => {
  it('defines the small tip product id', () => {
    expect(TIP_SMALL_PRODUCT_ID).toBe('com.michinoeki.magnets.tip.small');
    expect(TIP_PRODUCT_IDS).toEqual(['com.michinoeki.magnets.tip.small']);
  });
});
