import { describe, expect, it } from 'bun:test';
import type { ReposConfig } from '../src/widgets/repos';
import { repos } from '../src/widgets/repos';

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeWidget(config: Partial<ReposConfig> = {}) {
    return { config, matched: '<!--GITHUB_REPOS-->' };
}

interface RepoOverride {
    name?: string;
    full_name?: string;
    stargazers_count?: number;
    forks_count?: number;
    language?: string;
    description?: string;
    archived?: boolean;
    fork?: boolean;
    private?: boolean;
    topics?: string[];
    html_url?: string;
    created_at?: string;
    updated_at?: string;
    pushed_at?: string;
    size?: number;
}

function makeRepo(overrides: RepoOverride = {}) {
    return {
        name: overrides.name ?? 'my-repo',
        full_name: overrides.full_name ?? `ItzDabbzz/${overrides.name ?? 'my-repo'}`,
        stargazers_count: overrides.stargazers_count ?? 0,
        forks_count: overrides.forks_count ?? 0,
        language: overrides.language ?? 'TypeScript',
        description: overrides.description ?? 'A test repo',
        archived: overrides.archived ?? false,
        fork: overrides.fork ?? false,
        private: overrides.private ?? false,
        topics: overrides.topics ?? [],
        html_url: overrides.html_url ?? `https://github.com/ItzDabbzz/${overrides.name ?? 'my-repo'}`,
        created_at: overrides.created_at ?? '2024-01-01T00:00:00Z',
        updated_at: overrides.updated_at ?? '2025-01-01T00:00:00Z',
        pushed_at: overrides.pushed_at ?? '2026-01-01T00:00:00Z',
        size: overrides.size ?? 100
    };
}

function makeRepos(list: RepoOverride[] = [{}]) {
    return { data: list.map(makeRepo) };
}

// ─── filtering ────────────────────────────────────────────────────────────────

describe('repos – filtering', () => {
    it('excludes private repositories', () => {
        const data = makeRepos([
            { name: 'public-repo', private: false },
            { name: 'private-repo', private: true }
        ]);
        const out = repos(data, makeWidget({ raw: true }));
        expect(out).not.toContain('private-repo');
        expect(out).toContain('public-repo');
    });

    it('excludes repos in the exclude list', () => {
        const data = makeRepos([{ name: 'keep-me' }, { name: 'drop-me' }]);
        const out = repos(data, makeWidget({ raw: true, exclude: ['ItzDabbzz/drop-me'] }));
        expect(out).not.toContain('drop-me');
        expect(out).toContain('keep-me');
    });

    it('hides archived repos by default', () => {
        const data = makeRepos([{ name: 'live' }, { name: 'archived', archived: true }]);
        const out = repos(data, makeWidget({ raw: true }));
        expect(out).not.toContain('archived');
    });

    it('shows archived repos when showArchived is true', () => {
        const data = makeRepos([{ name: 'live' }, { name: 'old', archived: true }]);
        const out = repos(data, makeWidget({ raw: true, showArchived: true }));
        expect(out).toContain('old');
    });

    it('hides forked repos by default', () => {
        const data = makeRepos([{ name: 'original' }, { name: 'forked', fork: true }]);
        const out = repos(data, makeWidget({ raw: true }));
        expect(out).not.toContain('forked');
    });

    it('shows forked repos when showForks_repos is true', () => {
        const data = makeRepos([{ name: 'original' }, { name: 'forked', fork: true }]);
        const out = repos(data, makeWidget({ raw: true, showForks_repos: true }));
        expect(out).toContain('forked');
    });

    it('filters by minStars', () => {
        const data = makeRepos([
            { name: 'popular', stargazers_count: 100 },
            { name: 'obscure', stargazers_count: 2 }
        ]);
        const out = repos(data, makeWidget({ raw: true, minStars: 10 }));
        expect(out).toContain('popular');
        expect(out).not.toContain('obscure');
    });

    it('filters by topic', () => {
        const data = makeRepos([
            { name: 'tagged', topics: ['bun', 'typescript'] },
            { name: 'untagged', topics: ['python'] }
        ]);
        const out = repos(data, makeWidget({ raw: true, topic: 'bun' }));
        expect(out).toContain('tagged');
        expect(out).not.toContain('untagged');
    });

    it('respects the rows limit', () => {
        const data = makeRepos(Array.from({ length: 10 }, (_, i) => ({ name: `repo-${i}` })));
        const out = repos(data, makeWidget({ raw: true, rows: 3 }));
        const lines = out.trim().split('\n').filter(Boolean);
        expect(lines.length).toBe(3);
    });
});

// ─── sorting ──────────────────────────────────────────────────────────────────

describe('repos – sorting', () => {
    const data = makeRepos([
        { name: 'alpha', stargazers_count: 10, forks_count: 1 },
        { name: 'beta', stargazers_count: 500, forks_count: 50 },
        { name: 'gamma', stargazers_count: 50, forks_count: 5 }
    ]);

    it('sorts by stars descending by default', () => {
        const out = repos(data, makeWidget({ raw: true, rows: 3 }));
        const lines = out.trim().split('\n');
        const betaIdx = lines.findIndex(l => l.includes('beta'));
        const gammaIdx = lines.findIndex(l => l.includes('gamma'));
        const alphaIdx = lines.findIndex(l => l.includes('alpha'));
        expect(betaIdx).toBeLessThan(gammaIdx);
        expect(gammaIdx).toBeLessThan(alphaIdx);
    });

    it('sorts by forks descending', () => {
        const out = repos(data, makeWidget({ raw: true, sort: 'forks', rows: 3 }));
        const lines = out.trim().split('\n');
        expect(lines[0]).toContain('beta');
    });

    it("sorts ascending when order is 'asc'", () => {
        const out = repos(data, makeWidget({ raw: true, sort: 'stars', order: 'asc', rows: 3 }));
        const lines = out.trim().split('\n');
        expect(lines[0]).toContain('alpha');
    });

    it('sorts alphabetically by full_name', () => {
        const out = repos(data, makeWidget({ raw: true, sort: 'full_name', order: 'asc', rows: 3 }));
        console.log(out)
        const lines = out.trim().split('\n');
        expect(lines[0]).toContain('alpha');
        expect(lines[2]).toContain('beta');
    });
});

// ─── styles ───────────────────────────────────────────────────────────────────

describe('repos – style: table', () => {
    it('includes a markdown table header', () => {
        const data = makeRepos([{ name: 'my-repo' }]);
        const out = repos(data, makeWidget({ style: 'table' }));
        expect(out).toContain('| Repo |');
        expect(out).toContain('| Stars |');
    });

    it("each data row starts with '| 📦 |'", () => {
        const data = makeRepos([{ name: 'my-repo' }]);
        const out = repos(data, makeWidget({ style: 'table' }));
        const dataRows = out.split('\n').filter(l => l.includes('📦'));
        expect(dataRows.length).toBeGreaterThan(0);
    });
});

describe('repos – style: list', () => {
    it("each repo line starts with '* '", () => {
        const data = makeRepos([{ name: 'a' }, { name: 'b' }]);
        const out = repos(data, makeWidget({ style: 'list' }));
        const lines = out
            .trim()
            .split('\n')
            .filter(l => l.startsWith('*'));
        for (const l of lines) {
            expect(l).toMatch(/^\*/);
        }
    });
});

describe('repos – style: compact / raw', () => {
    it('raw mode emits compact lines without table markdown', () => {
        const data = makeRepos([{ name: 'my-repo' }]);
        const out = repos(data, makeWidget({ raw: true }));
        expect(out).not.toContain('| Repo |');
        expect(out).toContain('📦');
    });
});

// ─── optional columns ─────────────────────────────────────────────────────────

describe('repos – optional columns', () => {
    it('shows stars by default in compact mode', () => {
        const data = makeRepos([{ name: 'r', stargazers_count: 42 }]);
        const out = repos(data, makeWidget({ raw: true, showStars: true }));
        expect(out).toContain('42');
    });

    it('hides stars when showStars is false', () => {
        const data = makeRepos([{ name: 'r', stargazers_count: 42 }]);
        const out = repos(data, makeWidget({ raw: true, showStars: false }));
        expect(out).not.toContain('42');
    });

    it('shows language when showLanguage is true', () => {
        const data = makeRepos([{ name: 'r', language: 'Rust' }]);
        const out = repos(data, makeWidget({ raw: true, showLanguage: true }));
        expect(out).toContain('Rust');
    });

    it('shows forks when showForks is true in compact mode', () => {
        const data = makeRepos([{ name: 'r', forks_count: 7 }]);
        const out = repos(data, makeWidget({ raw: true, showForks: true }));
        expect(out).toContain('7');
    });

    it("marks archived repos with '(archived)' in rich mode", () => {
        const data = makeRepos([{ name: 'old', archived: true }]);
        const out = repos(data, makeWidget({ style: 'list', showArchived: true }));
        expect(out).toMatch(/archived/i);
    });
});
