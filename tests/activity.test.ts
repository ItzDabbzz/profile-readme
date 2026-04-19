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

    it('includes a date column when showDate is true', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ style: 'table', showDate: true }));
        expect(out).toContain('| When |');
        expect(out).toMatch(/ago|now|\d{4}/);
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

    it('uses a custom date format when specified', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ showDate: true, dateFormat: 'YYYY-MM-DD', style: 'compact' }));
        expect(out).toContain('2026-03-25');
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

// ─── event descriptions ───────────────────────────────────────────────────────

describe('activity – describeEvent outputs', () => {
    // A helper to test the output of a single event in raw/compact mode
    const testDescription = (type: string, expectedSubstring: string, overrides: Record<string, unknown> = {}) => {
        const event = makeEvent(type, 'user/repo', overrides);
        const out = activity({ data: [event] }, makeWidget({ raw: true }));
        expect(out).toContain(expectedSubstring);
    };

    it('CommitCommentEvent', () => {
        testDescription('CommitCommentEvent', 'Commented on commit `1234567` in **user/repo**', {
            payload: { comment: { commit_id: '1234567' } }
        });
        testDescription('CommitCommentEvent', 'Commented on a commit in **user/repo**', {
            payload: { comment: { commit_id: '' } }
        });
    });

    it('CreateEvent', () => {
        testDescription('CreateEvent', 'Created repository **user/repo**', {
            payload: { ref_type: 'repository' }
        });
        testDescription('CreateEvent', 'Created branch `feature` in **user/repo**', {
            payload: { ref_type: 'branch', ref: 'feature' }
        });
    });

    it('DeleteEvent', () => {
        testDescription('DeleteEvent', 'Deleted branch `feature` in **user/repo**', {
            payload: { ref_type: 'branch', ref: 'feature' }
        });
    });

    it('ForkEvent', () => {
        testDescription('ForkEvent', 'Forked **user/repo** → **other/fork**', {
            payload: { forkee: { full_name: 'other/fork' } }
        });
    });

    it('GollumEvent', () => {
        testDescription('GollumEvent', 'Created wiki page Home in **user/repo**', {
            payload: { pages: [{ action: 'created', title: 'Home' }] }
        });
        testDescription('GollumEvent', 'Edited wiki page API Docs in **user/repo**', {
            payload: { pages: [{ action: 'edited', page_name: 'API Docs' }] }
        });
        testDescription('GollumEvent', 'Edited wiki page Home (+2 more) in **user/repo**', {
            payload: { pages: [{ action: 'edited', title: 'Home' }, {}, {}] }
        });
        testDescription('GollumEvent', 'Updated wiki in **user/repo**', { payload: { pages: [] } });
    });

    it('IssueCommentEvent', () => {
        testDescription('IssueCommentEvent', 'Commented on issue #42 in **user/repo**', {
            payload: { issue: { number: 42 } }
        });
        testDescription('IssueCommentEvent', 'Commented on PR #42 in **user/repo**', {
            payload: { issue: { number: 42, pull_request: {} } }
        });
    });

    it('IssuesEvent', () => {
        testDescription('IssuesEvent', 'Opened issue #21 — _My Issue_ in **user/repo**', {
            payload: { action: 'opened', issue: { number: 21, title: 'My Issue' } }
        });
        testDescription('IssuesEvent', 'Closed issue #21 in **user/repo**', {
            payload: { action: 'closed', issue: { number: 21, title: '' } }
        });
    });

    it('MemberEvent', () => {
        testDescription('MemberEvent', 'Added @octocat as collaborator to **user/repo**', {
            payload: { action: 'added', member: { login: 'octocat' } }
        });
        testDescription('MemberEvent', 'Removed @octocat as collaborator to **user/repo**', {
            payload: { action: 'removed', member: { login: 'octocat' } }
        });
        testDescription('MemberEvent', 'Added @someone as collaborator to **user/repo**', {
            payload: { action: 'added', member: {} }
        });
    });

    it('PublicEvent', () => {
        testDescription('PublicEvent', 'Made **user/repo** public');
    });

    it('PullRequestEvent', () => {
        testDescription('PullRequestEvent', 'Opened PR #7 — _New Feature_ in **user/repo**', {
            payload: { action: 'opened', pull_request: { number: 7, title: 'New Feature' } }
        });
        testDescription('PullRequestEvent', 'Closed PR #7 in **user/repo**', {
            payload: { action: 'closed', pull_request: { number: 7, merged: false, title: '' } }
        });
        testDescription('PullRequestEvent', 'Merged PR #7 in **user/repo**', {
            payload: { action: 'closed', pull_request: { number: 7, merged: true, title: '' } }
        });
    });

    it('PullRequestReviewEvent', () => {
        testDescription('PullRequestReviewEvent', 'Approved PR #8 in **user/repo**', {
            payload: { pull_request: { number: 8 }, review: { state: 'approved' } }
        });
        testDescription('PullRequestReviewEvent', 'Requested changes on PR #8 in **user/repo**', {
            payload: { pull_request: { number: 8 }, review: { state: 'changes_requested' } }
        });
        testDescription('PullRequestReviewEvent', 'Commented on PR #8 in **user/repo**', {
            payload: { pull_request: { number: 8 }, review: { state: 'commented' } }
        });
        testDescription('PullRequestReviewEvent', 'Dismissed review on PR #8 in **user/repo**', {
            payload: { pull_request: { number: 8 }, review: { state: 'dismissed' } }
        });
        testDescription('PullRequestReviewEvent', 'Reviewed PR #8 in **user/repo**', {
            payload: { pull_request: { number: 8 }, review: { state: 'unknown_state' } }
        });
    });

    it('PullRequestReviewCommentEvent', () => {
        testDescription('PullRequestReviewCommentEvent', 'Commented on a review of PR #9 in **user/repo**', {
            payload: { pull_request: { number: 9 } }
        });
    });

    it('PullRequestReviewThreadEvent', () => {
        testDescription('PullRequestReviewThreadEvent', 'Resolved a review thread on PR #10 in **user/repo**', {
            payload: { action: 'resolved', pull_request: { number: 10 } }
        });
        testDescription('PullRequestReviewThreadEvent', 'Unresolved a review thread on PR #10 in **user/repo**', {
            payload: { action: 'unresolved', pull_request: { number: 10 } }
        });
    });

    it('PushEvent', () => {
        testDescription('PushEvent', 'Pushed 1 commit to `main` in **user/repo**', {
            payload: { size: 1, ref: 'refs/heads/main', head: '' }
        });
        testDescription('PushEvent', 'Pushed 3 commits to `main` in **user/repo**', {
            payload: { size: 3, ref: 'refs/heads/main', head: '' }
        });
        testDescription('PushEvent', 'Pushed to `main` in **user/repo** (`1234567`)', {
            payload: { ref: 'refs/heads/main', head: '1234567' }
        });
    });

    it('ReleaseEvent', () => {
        testDescription('ReleaseEvent', 'Published release `Version 1.0.0` in **user/repo**', {
            payload: { action: 'published', release: { tag_name: 'v1.0.0', name: 'Version 1.0.0' } }
        });
        testDescription('ReleaseEvent', 'Created release `v1.0.0` in **user/repo**', {
            payload: { action: 'created', release: { tag_name: 'v1.0.0', name: '' } }
        });
    });

    it('SponsorshipEvent', () => {
        testDescription('SponsorshipEvent', 'Started sponsoring @dabbzz', {
            payload: { action: 'created', sponsorship: { sponsorable: { login: 'dabbzz' } } }
        });
        testDescription('SponsorshipEvent', 'Cancelled sponsorship of @dabbzz', {
            payload: { action: 'cancelled', sponsorship: { sponsorable: { login: 'dabbzz' } } }
        });
        testDescription('SponsorshipEvent', 'Started sponsoring @someone', {
            payload: { action: 'created', sponsorship: { sponsorable: {} } }
        });
    });

    it('WatchEvent', () => {
        testDescription('WatchEvent', 'Starred **user/repo**');
    });

    it('handles unknown event types', () => {
        const event = makeEvent('MadeUpEvent', 'user/repo');
        const out = activity({ data: [event] }, makeWidget({ raw: true, include: ['MadeUpEvent'] }));
        expect(out).toContain('MadeUp in **user/repo**');
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

    it('defaults to true if showLinks is undefined', () => {
        const events = makeEvents(['PushEvent']);
        const out = activity(events, makeWidget({ style: 'table' }));
        expect(out).toContain('**[ItzDabbzz/test-repo](https://github.com/ItzDabbzz/test-repo)**');
    });
});
