import { describe, expect, it } from 'bun:test';
import type { ActivityConfig } from '../src/widgets/activity';
import { activity } from '../src/widgets/activity';

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeWidget(config: Partial<ActivityConfig> = {}) {
    return { config, matched: '<!--GITHUB_ACTIVITY-->' };
}

/** Minimal valid GitHub event factory. */
function makeEvent(
    type: string,
    repoName = 'ItzDabbzz/test-repo',
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    const payloads: Record<string, unknown> = {
        PushEvent: {
            commits: [{ message: 'fix: something' }],
            ref: 'refs/heads/main',
            size: 1
        },
        PullRequestEvent: {
            action: 'opened',
            pull_request: { number: 1, title: 'My PR', html_url: '' }
        },
        PullRequestReviewEvent: {
            action: 'submitted',
            pull_request: { number: 1, title: 'My PR' },
            review: { state: 'approved' }
        },
        PullRequestReviewCommentEvent: {
            pull_request: { number: 1 },
            comment: { body: 'Nice' }
        },
        IssuesEvent: {
            action: 'opened',
            issue: { number: 2, title: 'Bug', html_url: '' }
        },
        IssueCommentEvent: {
            issue: { number: 2, title: 'Bug' },
            comment: { html_url: '' }
        },
        ForkEvent: { forkee: { full_name: 'other/test-repo', html_url: '' } },
        ReleaseEvent: {
            action: 'published',
            release: { tag_name: 'v1.0.0', name: 'v1.0.0', html_url: '' }
        },
        WatchEvent: { action: 'started' },
        CreateEvent: { ref_type: 'branch', ref: 'main' },
        DeleteEvent: { ref_type: 'branch', ref: 'old-branch' },
        PublicEvent: {},
        MemberEvent: { action: 'added', member: { login: 'someone' } },
        SponsorshipEvent: { action: 'created' }
    };

    return {
        type,
        id: '1',
        created_at: '2026-03-25T12:00:00Z',
        repo: { name: repoName },
        payload: payloads[type] ?? {},
        ...overrides
    };
}

function makeEvents(types: string[]) {
    return { data: types.map(t => makeEvent(t)) };
}

// ─── filtering ────────────────────────────────────────────────────────────────

describe('activity – filtering', () => {
    it('respects the rows limit', () => {
        const events = makeEvents(Array(10).fill('PushEvent'));
        const out = activity(events, makeWidget({ rows: 3, style: 'compact', raw: true }));
        const lines = out.trim().split('\n').filter(Boolean);
        expect(lines.length).toBeLessThanOrEqual(3);
    });

    it('excludes specified event types', () => {
        const events = makeEvents(['PushEvent', 'WatchEvent', 'ForkEvent']);
        const out = activity(events, makeWidget({ exclude: ['WatchEvent'], raw: true }));
        expect(out).not.toMatch(/star/i);
    });

    it('only includes specified event types', () => {
        const events = makeEvents(['PushEvent', 'WatchEvent', 'ForkEvent']);
        const out = activity(events, makeWidget({ include: ['PushEvent'], raw: true }));
        expect(out).not.toMatch(/star|fork/i);
    });

    it('returns empty string when all events are excluded', () => {
        const events = makeEvents(['WatchEvent']);
        const out = activity(events, makeWidget({ exclude: ['WatchEvent'], raw: true }));
        expect(out.trim()).toBe('');
    });
});

// ─── styles ───────────────────────────────────────────────────────────────────

describe('activity – style: table', () => {
    it('outputs a markdown table header row', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ style: 'table' }));
        expect(out).toContain('| Event |');
        expect(out).toContain('| Repo |');
    });

    it('each data row starts with a pipe character', () => {
        const events = makeEvents(['PushEvent', 'ForkEvent']);
        const out = activity(events, makeWidget({ style: 'table' }));
        const dataRows = out.split('\n').filter(l => l.startsWith('|') && !l.includes('---'));
        // header + 2 data rows
        expect(dataRows.length).toBeGreaterThanOrEqual(2);
    });
});

describe('activity – style: list', () => {
    it("each line starts with '* '", () => {
        const events = makeEvents(['PushEvent', 'WatchEvent']);
        const out = activity(events, makeWidget({ style: 'list' }));
        const lines = out.trim().split('\n');
        for (const line of lines) {
            expect(line).toMatch(/^\*/);
        }
    });
});

describe('activity – style: compact / raw', () => {
    it('raw mode forces compact output (no table pipes)', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ raw: true }));
        expect(out).not.toContain('|');
    });

    it('compact style does not output table markdown', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ style: 'compact' }));
        expect(out).not.toContain('|');
    });
});

// ─── showDate ─────────────────────────────────────────────────────────────────

describe('activity – showDate', () => {
    it('includes a date string when showDate is true', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ showDate: true, style: 'compact' }));
        // Relative dates contain "ago" or "now"; formatted contain digits
        expect(out).toMatch(/ago|now|\d{4}/);
    });

    it('omits date info when showDate is false (default)', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ showDate: false, style: 'compact' }));
        expect(out).not.toMatch(/ago|now|\d{4}-\d{2}-\d{2}/);
    });
});

// ─── groupByRepo ──────────────────────────────────────────────────────────────

describe('activity – groupByRepo', () => {
    it('renders a repo header for each distinct repository', () => {
        const events = {
            data: [
                makeEvent('PushEvent', 'ItzDabbzz/repo-a'),
                makeEvent('WatchEvent', 'ItzDabbzz/repo-b'),
                makeEvent('ForkEvent', 'ItzDabbzz/repo-a')
            ]
        };
        const out = activity(events, makeWidget({ groupByRepo: true }));
        expect(out).toContain('📁');
        expect(out).toContain('repo-a');
        expect(out).toContain('repo-b');
    });

    it('groups events from the same repo together', () => {
        const events = {
            data: [makeEvent('PushEvent', 'ItzDabbzz/mono-repo'), makeEvent('WatchEvent', 'ItzDabbzz/mono-repo')]
        };
        const out = activity(events, makeWidget({ groupByRepo: true }));
        // Only one header expected
        const headers = out.split('\n').filter(l => l.includes('📁'));
        expect(headers.length).toBe(1);
    });
});

// ─── showLinks ────────────────────────────────────────────────────────────────

describe('activity – showLinks', () => {
    it('includes markdown links when showLinks is true', () => {
        const events = makeEvents(['PullRequestEvent']);
        const out = activity(events, makeWidget({ showLinks: true, style: 'list' }));
        expect(out).toMatch(/\[.*\]\(https?:\/\//);
    });

    it('omits markdown links when showLinks is false', () => {
        const events = makeEvents(['PullRequestEvent']);
        const out = activity(events, makeWidget({ showLinks: false, raw: true }));
        expect(out).not.toMatch(/\[.*\]\(https?:\/\//);
    });
});
