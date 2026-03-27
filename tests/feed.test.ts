import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { FeedConfig } from '../src/widgets/feed';
import { __resetFeedCache, feed } from '../src/widgets/feed';

// ─── mock rss-parser ──────────────────────────────────────────────────────────
//
// We mock the rss-parser module so no real HTTP calls happen.

const MOCK_ITEMS = [
    { title: 'First Post', link: 'https://example.com/1', isoDate: '2026-01-01' },
    {
        title: 'Second Post',
        link: 'https://example.com/2',
        isoDate: '2026-01-02'
    },
    { title: 'Third Post', link: 'https://example.com/3', isoDate: '2026-01-03' },
    {
        title: 'Fourth Post',
        link: 'https://example.com/4',
        isoDate: '2026-01-04'
    },
    { title: 'Fifth Post', link: 'https://example.com/5', isoDate: '2026-01-05' },
    { title: 'Sixth Post', link: 'https://example.com/6', isoDate: '2026-01-06' }
];

mock.module('rss-parser', () => {
    return {
        default: class Parser {
            async parseURL(_url: string) {
                return { title: 'Mock Feed', items: MOCK_ITEMS };
            }
        }
    };
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeWidget(config: Partial<FeedConfig> = {}) {
    return { config, matched: '<!--FEED-->' };
}

const SUBSCRIBE = {
    'tech news': 'https://feeds.example.com/tech',
    'bun blog': 'https://feeds.example.com/bun',
    gaming: 'https://feeds.example.com/gaming'
};

// ─── basic rendering ──────────────────────────────────────────────────────────

describe('feed – basic output', () => {
    it('returns a non-empty string', async () => {
        const out = await feed(SUBSCRIBE, makeWidget());
        expect(out.trim().length).toBeGreaterThan(0);
    });

    it('includes at least one post link', async () => {
        const out = await feed(SUBSCRIBE, makeWidget());
        expect(out).toMatch(/https?:\/\//);
    });
});

// ─── rows limit ───────────────────────────────────────────────────────────────

describe('feed – rows', () => {
    it('defaults to 5 rows', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: true }));
        const lines = out
            .trim()
            .split('\n')
            .filter(l => l.match(/^\d+\./));
        expect(lines.length).toBe(5);
    });

    it('respects a custom rows value', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: true, rows: 2 }));
        const lines = out
            .trim()
            .split('\n')
            .filter(l => l.match(/^\d+\./));
        expect(lines.length).toBe(2);
    });

    it('returns all available items when rows exceeds item count', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: true, rows: 100 }));
        const lines = out
            .trim()
            .split('\n')
            .filter(l => l.match(/^\d+\./));
        expect(lines.length).toBe(MOCK_ITEMS.length);
    });
});

// ─── table vs raw ────────────────────────────────────────────────────────────

describe('feed – raw mode', () => {
    it('renders a numbered list when raw is true', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: true }));
        expect(out).toMatch(/^1\./m);
        expect(out).not.toContain('|Index|');
    });
});

describe('feed – table mode (default)', () => {
    it('includes a markdown table header', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: false }));
        expect(out).toContain('|Index|');
        expect(out).toContain('|Posts|');
        expect(out).toContain('|Domain|');
    });

    it('has a separator row (---)', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ raw: false }));
        expect(out).toMatch(/\|---/);
    });
});

// ─── title ───────────────────────────────────────────────────────────────────

describe('feed – title', () => {
    it('prepends a section header when title is true', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ title: true }));
        // Header uses ### and a feed name from SUBSCRIBE
        expect(out).toMatch(/^### /m);
    });

    it('includes the feed URL in the title block', async () => {
        const out = await feed(
            { 'tech news': 'https://feeds.example.com/tech' },
            makeWidget({ title: true, select: ['tech news'] })
        );
        expect(out).toContain('https://feeds.example.com/tech');
    });

    it('does not add a header when title is false (default)', async () => {
        const out = await feed(SUBSCRIBE, makeWidget({ title: false }));
        expect(out).not.toMatch(/^### /m);
    });
});

// ─── select ──────────────────────────────────────────────────────────────────

describe('feed – select', () => {
    it('uses only the specified feed when select is a single string', async () => {
        // When only one feed is available, pickRandomItems always returns it.
        const singleFeed = { 'bun blog': 'https://feeds.example.com/bun' };
        const out = await feed(singleFeed, makeWidget({ raw: true, title: true, select: ['bun blog'] }));
        expect(out).toContain('bun blog');
    });

    it('does not include feeds outside the select list', async () => {
        // Supply a subscribe map where only one feed is selected.
        const out = await feed(SUBSCRIBE, makeWidget({ title: true, select: ['tech news'] }));
        // "bun blog" or "gaming" should not appear in the title block.
        expect(out).not.toContain('bun blog');
        expect(out).not.toContain('gaming');
    });
});

// ─── shuffle ─────────────────────────────────────────────────────────────────

describe('feed – shuffle', () => {
    it('returns the same number of items whether shuffled or not', async () => {
        const normal = await feed(SUBSCRIBE, makeWidget({ raw: true, rows: 4, shuffle: false }));
        const shuffled = await feed(SUBSCRIBE, makeWidget({ raw: true, rows: 4, shuffle: true }));

        const countLines = (s: string) =>
            s
                .trim()
                .split('\n')
                .filter(l => l.match(/^\d+\./)).length;
        expect(countLines(normal)).toBe(4);
        expect(countLines(shuffled)).toBe(4);
    });
});

// ─── sanitization ────────────────────────────────────────────────────────────

describe('feed – sanitization', () => {
    beforeEach(() => {
        __resetFeedCache(); // ← clear cache so mocks always get called
    });

    it('does not break table output when title contains a pipe character', async () => {
        mock.module('rss-parser', () => ({
            default: class Parser {
                async parseURL() {
                    return {
                        title: 'Piped Feed',
                        items: [{ title: 'A | B', link: 'https://example.com/pipe' }]
                    };
                }
            }
        }));
        const out = await feed(SUBSCRIBE, makeWidget({ raw: false, rows: 1 }));
        expect(out).not.toMatch(/A \| B/);
        expect(out).toContain('A \\| B');
    });
});
