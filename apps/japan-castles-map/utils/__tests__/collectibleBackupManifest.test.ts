import { strToU8, zipSync } from 'fflate';

import {
  COLLECTIBLE_BACKUP_MANIFEST_NAME,
  COLLECTIBLE_BACKUP_PROGRESS_NAME,
  COLLECTIBLE_BACKUP_VERSION,
} from '../../types/collectibleBackup';
import {
  buildManifestFromArchive,
  isZipArchive,
  normalizeExtractedArchive,
  parseCollectibleZipPath,
  parseManifestBytes,
  parseManifestEntry,
  resolveImportManifest,
  validateManifest,
} from '../collectibleBackupManifest';

describe('collectibleBackupManifest', () => {
  describe('parseManifestBytes', () => {
    it('parses valid JSON manifest bytes', () => {
      const raw = parseManifestBytes(
        strToU8(JSON.stringify({ version: COLLECTIBLE_BACKUP_VERSION, collectibles: [] })),
      );

      expect(raw).toEqual({ version: COLLECTIBLE_BACKUP_VERSION, collectibles: [] });
    });

    it('throws for invalid JSON', () => {
      expect(() => parseManifestBytes(strToU8('{not-json'))).toThrow(
        'collectible-backup-invalid-manifest',
      );
    });
  });

  describe('parseCollectibleZipPath', () => {
    it('parses archive entry paths', () => {
      expect(parseCollectibleZipPath('castle-collectibles/12/meijo-stamp/stamp.jpg')).toEqual({
        castleId: 12,
        kind: 'meijo-stamp',
        filename: 'stamp.jpg',
      });
    });

    it('rejects invalid paths', () => {
      expect(parseCollectibleZipPath('manifest.json')).toBeNull();
      expect(parseCollectibleZipPath('castle-collectibles/0/goshuin/a.jpg')).toBeNull();
    });
  });

  describe('parseManifestEntry', () => {
    it('parses zipPath-based entries', () => {
      expect(
        parseManifestEntry({
          zipPath: 'castle-collectibles/3/goshuin/page-1.jpg',
        }),
      ).toEqual({
        castleId: 3,
        kind: 'goshuin',
        filename: 'page-1.jpg',
      });
    });

    it('parses explicit castleId/kind/filename entries', () => {
      expect(
        parseManifestEntry({
          castleId: 5,
          kind: 'castle-card',
          filename: 'card.jpg',
        }),
      ).toEqual({
        castleId: 5,
        kind: 'castle-card',
        filename: 'card.jpg',
      });
    });
  });

  describe('validateManifest', () => {
    it('accepts a valid manifest', () => {
      const manifest = validateManifest({
        version: COLLECTIBLE_BACKUP_VERSION,
        exportedAt: 1_700_000_000_000,
        collectibles: [
          {
            castleId: 1,
            kind: 'meijo-stamp',
            filename: 'stamp.jpg',
          },
        ],
      });

      expect(manifest.collectibles).toHaveLength(1);
      expect(manifest.collectibles[0]?.zipPath).toBe('castle-collectibles/1/meijo-stamp/stamp.jpg');
    });

    it('rejects unsupported versions', () => {
      expect(() =>
        validateManifest({
          version: 999,
          collectibles: [],
        }),
      ).toThrow('collectible-backup-unsupported-version');
    });

    it('rejects empty archives by default', () => {
      expect(() =>
        validateManifest({
          version: COLLECTIBLE_BACKUP_VERSION,
          collectibles: [],
        }),
      ).toThrow('collectible-backup-empty-archive');
    });

    it('allows empty collectibles when explicitly requested', () => {
      const manifest = validateManifest(
        {
          version: COLLECTIBLE_BACKUP_VERSION,
          collectibles: [],
        },
        { allowEmptyCollectibles: true },
      );

      expect(manifest.collectibles).toEqual([]);
    });

    it('skips invalid collectible entries instead of failing the whole manifest', () => {
      const manifest = validateManifest({
        version: COLLECTIBLE_BACKUP_VERSION,
        collectibles: [{ castleId: -1, kind: 'goshuin', filename: 'bad.jpg' }, 'invalid', {
          castleId: 2,
          kind: 'goshuin',
          filename: 'good.jpg',
        }],
      });

      expect(manifest.collectibles).toHaveLength(1);
      expect(manifest.collectibles[0]?.castleId).toBe(2);
    });
  });

  describe('normalizeExtractedArchive', () => {
    it('normalizes zip entry paths', () => {
      const normalized = normalizeExtractedArchive({
        '.\\castle-collectibles\\1\\goshuin\\a.jpg': new Uint8Array([1]),
      });

      expect(Object.keys(normalized)[0]).toBe('castle-collectibles/1/goshuin/a.jpg');
    });
  });

  describe('resolveImportManifest', () => {
    it('reads manifest.json from extracted archive bytes', () => {
      const manifest = {
        version: COLLECTIBLE_BACKUP_VERSION,
        exportedAt: 1,
        collectibles: [{ castleId: 1, kind: 'goshuin', filename: 'a.jpg' }],
      };
      const extracted = {
        [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8(JSON.stringify(manifest)),
      };

      const result = resolveImportManifest(extracted);
      expect(result.collectibles).toHaveLength(1);
      expect(result.collectibles[0]?.castleId).toBe(1);
    });

    it('falls back to archive file paths when manifest is invalid', () => {
      const extracted = {
        [COLLECTIBLE_BACKUP_MANIFEST_NAME]: strToU8('{bad-json'),
        'castle-collectibles/2/meijo-stamp/stamp.jpg': new Uint8Array([1, 2, 3]),
      };

      const result = resolveImportManifest(extracted);
      expect(result.collectibles).toHaveLength(1);
      expect(result.collectibles[0]?.kind).toBe('meijo-stamp');
    });

    it('allows progress-only archives when configured', () => {
      const result = resolveImportManifest(
        {
          [COLLECTIBLE_BACKUP_PROGRESS_NAME]: strToU8('{"1":{"visited":true}}'),
        },
        { allowEmptyCollectibles: true },
      );

      expect(result.collectibles).toEqual([]);
    });

    it('throws for archives with no manifest or collectible files', () => {
      expect(() =>
        resolveImportManifest({ 'readme.txt': strToU8('hello') }),
      ).toThrow('collectible-backup-invalid-manifest');
    });
  });

  describe('buildManifestFromArchive', () => {
    it('builds a manifest from collectible file paths', () => {
      const manifest = buildManifestFromArchive({
        'castle-collectibles/4/goshuin/page.jpg': new Uint8Array([1]),
      });

      expect(manifest?.collectibles[0]).toMatchObject({
        castleId: 4,
        kind: 'goshuin',
        filename: 'page.jpg',
      });
    });
  });

  describe('isZipArchive', () => {
    it('detects zip signatures', () => {
      const zipBytes = zipSync({ 'manifest.json': strToU8('{}') });
      expect(isZipArchive(zipBytes)).toBe(true);
      expect(isZipArchive(new Uint8Array([1, 2, 3]))).toBe(false);
    });
  });
});
