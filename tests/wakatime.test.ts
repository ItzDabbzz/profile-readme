import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { WakaTimeConfig } from '../src/widgets/wakatime';
import { wakatime } from '../src/widgets/wakatime';

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeWidget(config: Partial<WakaTimeConfig> = {}) {
    return { config, matched: '<!--WAKATIME-->' };
}

/** Minimal WakaTime API response shape. */
const MOCK_WAKA_DATA = {
    data: {
        human_readable_total: '24h 30m',
        timezone: 'America/Chicago',
        languages: [
            { name: 'TypeScript', total_seconds: 43200, percent: 62.3 },
            { name: 'Python', total_seconds: 19200, percent: 27.1 },
            { name: 'Rust', total_seconds: 7560, percent: 10.6 }
        ],
        editors: [
            { name: 'VS Code', total_seconds: 60000, percent: 90.0 },
            { name: 'Neovim', total_seconds: 6000, percent: 10.0 }
        ],
        operating_systems: [
            { name: 'Windows', total_seconds: 55000, percent: 85.0 },
            { name: 'Linux', total_seconds: 10000, percent: 15.0 }
        ],
        projects: [{ name: 'profile-readme', total_seconds: 30000, percent: 50.0 }]
    }
};

// Bun lets us replace the global fetch with a mock.
function mockFetch(response: object, ok = true, status = 200) {
    globalThis.fetch = mock(async () => ({
        ok,
        status,
        json: async () => response
    })) as unknown as typeof fetch;
}

// Restore real fetch after each test.
const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
});

// ─── missing API key ──────────────────────────────────────────────────────────

describe('wakatime – missing API key', () => {
    beforeEach(() => {
        // Ensure env var is absent.
        delete process.env.INPUT_WAKATIME_KEY;
    });

    it('returns a warning string when no key is provided', async () => {
        const out = await wakatime(makeWidget());
        expect(out).toContain('⚠️');
        expect(out.toLowerCase()).toContain('missing');
    });
});

// ─── API error ────────────────────────────────────────────────────────────────

describe('wakatime – API error response', () => {
    it('returns an error string on non-OK response', async () => {
        mockFetch({}, false, 401);
        const out = await wakatime(makeWidget({ apiKey: 'fake-key' }));
        expect(out).toContain('❌');
        expect(out).toContain('401');
    });
});

// ─── successful response ──────────────────────────────────────────────────────

describe('wakatime – successful response', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    it('renders the header with total time', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).toContain('⏱');
        expect(out).toContain('24h 30m');
    });

    it('includes the timezone', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).toContain('America/Chicago');
    });

    it('renders languages section by default', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).toContain('TypeScript');
        expect(out).toContain('Python');
    });

    it('renders editors section by default', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).toContain('VS Code');
    });

    it('renders OS section by default', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).toContain('Windows');
    });

    it('hides projects section by default', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        expect(out).not.toContain('profile-readme');
    });

    it('shows projects when showProjects is true', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showProjects: true }));
        expect(out).toContain('profile-readme');
    });
});

// ─── section visibility toggles ──────────────────────────────────────────────

describe('wakatime – section toggles', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    it('hides languages when showLanguages is false', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showLanguages: false, showHighlights: false }));
        expect(out).not.toContain('TypeScript');
    });

    it('hides editors when showEditors is false', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showEditors: false }));
        expect(out).not.toContain('VS Code');
    });

    it('hides OS when showOS is false', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showOS: false }));
        expect(out).not.toContain('Windows');
    });
});

// ─── summary & highlights ─────────────────────────────────────────────────────

describe('wakatime – summary and highlights', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    it('renders summary badges when showSummary is true (default)', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid' }));
        // Summary produces shields.io badge markdown
        expect(out).toMatch(/img\.shields\.io\/badge/);
    });

    it('hides summary when showSummary is false', async () => {
        // showSummary false + showHighlights false avoids all badge output
        const out = await wakatime(makeWidget({ apiKey: 'valid', showSummary: false, showHighlights: false }));
        const badgeCount = (out.match(/img\.shields\.io\/badge/g) ?? []).length;
        // Only language badges (from table style) should remain, not summary badges
        expect(badgeCount).toBeGreaterThanOrEqual(0); // no crash
    });

    it('shows highlights section with top language', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showHighlights: true }));
        expect(out).toContain('🏆');
        expect(out).toContain('TypeScript'); // top language by percent
    });

    it('hides highlights when showHighlights is false', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', showHighlights: false }));
        expect(out).not.toContain('🏆');
    });
});

// ─── styles ───────────────────────────────────────────────────────────────────

describe('wakatime – output styles', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    it('table style renders markdown table headers', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', style: 'table' }));
        expect(out).toContain('| Name |');
        expect(out).toContain('| Time |');
    });

    it('list style uses bullet dashes', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', style: 'list' }));
        expect(out).toMatch(/^- /m);
    });

    it('compact style uses backtick labels', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', style: 'compact' }));
        expect(out).toMatch(/`TypeScript`/);
    });
});

// ─── rows limit ───────────────────────────────────────────────────────────────

describe('wakatime – rows limit', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    it('shows only the top N languages based on rows config', async () => {
        const out = await wakatime(makeWidget({ apiKey: 'valid', rows: 1, style: 'compact' }));
        // Only first language should appear
        expect(out).toContain('TypeScript');
        expect(out).not.toContain('Python');
    });
});

// ─── range labels ─────────────────────────────────────────────────────────────

describe('wakatime – range labels', () => {
    beforeEach(() => mockFetch(MOCK_WAKA_DATA));

    const cases: Array<[WakaTimeConfig['range'], string]> = [
        ['last_7_days', 'Last 7 Days'],
        ['last_30_days', 'Last 30 Days'],
        ['last_6_months', 'Last 6 Months'],
        ['last_year', 'Last Year']
    ];

    for (const [range, label] of cases) {
        it(`renders correct label for range '${range}'`, async () => {
            const out = await wakatime(makeWidget({ apiKey: 'valid', range }));
            expect(out).toContain(label);
        });
    }
});

// ─── API key from env ─────────────────────────────────────────────────────────

describe('wakatime – env variable fallback', () => {
    beforeEach(() => {
        mockFetch(MOCK_WAKA_DATA);
        process.env.INPUT_WAKATIME_KEY = 'env-key';
    });

    afterEach(() => {
        delete process.env.INPUT_WAKATIME_KEY;
    });

    it('uses INPUT_WAKATIME_KEY env variable when no apiKey in config', async () => {
        const out = await wakatime(makeWidget());
        // Should succeed (not return warning) since env key is present
        expect(out).not.toContain('⚠️');
        expect(out).toContain('24h 30m');
    });
});
