import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import moment from 'moment-timezone';
import type { TimestampConfig } from '../src/widgets/timestamp';
import { timestamp } from '../src/widgets/timestamp';

// Helper to build a minimal Widget<TimestampConfig> fixture.
function makeWidget(config: Partial<TimestampConfig> = {}) {
    return { config, matched: '<!--TIMESTAMP-->' };
}

// ─── badge output ─────────────────────────────────────────────────────────────

describe('timestamp – badge mode (default)', () => {
    it('returns a shields.io markdown image string', () => {
        const out = timestamp(makeWidget());
        expect(out).toMatch(/^!\[.*\]\(https:\/\/img\.shields\.io\/badge\//);
    });

    it("uses the default label 'Updated'", () => {
        const out = timestamp(makeWidget());
        expect(out).toContain('Updated');
    });

    it('uses a custom label when provided', () => {
        const out = timestamp(makeWidget({ label: 'Refreshed' }));
        expect(out).toContain('Refreshed');
    });

    it('uses a custom hex color', () => {
        const out = timestamp(makeWidget({ color: 'ff0000' }));
        expect(out).toContain('ff0000');
    });

    it('defaults to color 58a6ff', () => {
        const out = timestamp(makeWidget());
        expect(out).toContain('58a6ff');
    });
});

// ─── plain (non-badge) output ─────────────────────────────────────────────────

describe('timestamp – plain mode (badge: false)', () => {
    it('returns a plain string, not a markdown image', () => {
        const out = timestamp(makeWidget({ badge: false }));
        expect(out).not.toMatch(/^!\[/);
    });

    it('formats the date using the default format', () => {
        // Output should look like "Mar 25 2026, 12:00 PM"
        const out = timestamp(makeWidget({ badge: false }));
        expect(out).toMatch(/\w{3} \d{1,2} \d{4},/);
    });

    it('respects a custom moment.js format string', () => {
        const out = timestamp(makeWidget({ badge: false, format: 'YYYY' }));
        expect(out).toMatch(/^\d{4}$/);
    });
});

// ─── modes ────────────────────────────────────────────────────────────────────

describe('timestamp – mode: unix', () => {
    it('returns a numeric unix timestamp string (badge: false)', () => {
        const out = timestamp(makeWidget({ badge: false, mode: 'unix' }));
        expect(out).toMatch(/^\d+$/);
        expect(Number(out)).toBeGreaterThan(0);
    });
});

describe('timestamp – mode: iso', () => {
    it('returns an ISO 8601 string (badge: false)', () => {
        const out = timestamp(makeWidget({ badge: false, mode: 'iso' }));
        expect(() => new Date(out)).not.toThrow();
        expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('timestamp – mode: relative', () => {
    it('returns a relative time string (badge: false)', () => {
        const out = timestamp(makeWidget({ badge: false, mode: 'relative' }));
        // moment's fromNow() always contains 'ago' or 'now' in English
        expect(out.toLowerCase()).toMatch(/ago|now|seconds|minutes|hours/);
    });
});

// ─── timezone handling ────────────────────────────────────────────────────────

describe('timestamp – timezone', () => {
    it('falls back to UTC when no tz is provided', () => {
        const out = timestamp(makeWidget({ badge: false, mode: 'iso' }));
        expect(out.endsWith('Z')).toBe(true);
    });

    it('accepts a valid IANA timezone without throwing', () => {
        expect(() => timestamp(makeWidget({ badge: false, tz: 'America/New_York' }))).not.toThrow();
    });

    it('falls back to UTC for an invalid timezone', () => {
        const out = timestamp(makeWidget({ badge: false, mode: 'iso', tz: 'Not/AZone' }));
        expect(out.endsWith('Z')).toBe(true);
    });
});

// ─── badge value sanitization ─────────────────────────────────────────────────

describe('timestamp – badge value sanitization', () => {
    it("ISO badge does not contain raw colons (shields.io breaks on ':')", () => {
        const out = timestamp(makeWidget({ mode: 'iso' }));
        // Colons in the value segment would break shields.io; they should be
        // replaced with '-' by safeBadgeValue before URL encoding.
        // After encodeURIComponent, ':' → '%3A' and '-' stays '-'.
        // We verify no raw unencoded colon appears in the URL path segment.
        const url = out.match(/\((.+)\)/)?.[1] ?? '';
        const valuePart = url.split('/badge/')[1] ?? '';
        expect(valuePart).not.toContain(':');
    });
});
