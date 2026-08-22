import { hasCastleCardSalesLocation, setCastleContentForLocale } from '../../i18n/castleContent';

describe('castle card sales availability', () => {
  afterEach(() => {
    setCastleContentForLocale('zh-Hant', {});
  });

  it('returns true when a castle has castle card locations', () => {
    setCastleContentForLocale('zh-Hant', {
      '173': {
        castleCardLocations: [{ label: '本郷町觀光協會' }],
      },
    });

    expect(hasCastleCardSalesLocation(173)).toBe(true);
  });

  it('returns false when a castle has no castle card locations', () => {
    setCastleContentForLocale('zh-Hant', {
      '99': {},
    });

    expect(hasCastleCardSalesLocation(99)).toBe(false);
  });
});
