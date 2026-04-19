import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

type CoreState = {
    endGroupCount: number;
    errors: string[];
    failed: string[];
    groups: string[];
    infos: string[];
    inputs: Record<string, string>;
    secrets: string[];
    warnings: string[];
};

const coreState: CoreState = {
    endGroupCount: 0,
    errors: [],
    failed: [],
    groups: [],
    infos: [],
    inputs: {},
    secrets: [],
    warnings: []
};

const fsState = {
    template: '',
    written: ''
};

function resetCoreState(): void {
    coreState.endGroupCount = 0;
    coreState.errors = [];
    coreState.failed = [];
    coreState.groups = [];
    coreState.infos = [];
    coreState.inputs = {};
    coreState.secrets = [];
    coreState.warnings = [];
}

mock.module('@actions/core', () => ({
    endGroup: () => {
        coreState.endGroupCount += 1;
    },
    error: (message: unknown) => {
        coreState.errors.push(String(message));
    },
    getInput: (name: string) => coreState.inputs[name] ?? '',
    info: (message: unknown) => {
        coreState.infos.push(String(message));
    },
    setFailed: (message: unknown) => {
        coreState.failed.push(String(message));
    },
    setSecret: (secret: string) => {
        coreState.secrets.push(secret);
    },
    startGroup: (name: string) => {
        coreState.groups.push(name);
    },
    warning: (message: unknown) => {
        coreState.warnings.push(String(message));
    }
}));

mock.module('@actions/github', () => ({
    getOctokit: () => ({
        rest: {
            activity: {
                listPublicEventsForUser: async () => ({ data: [] })
            },
            repos: {
                listForUser: async () => ({ data: [] })
            }
        }
    })
}));

mock.module('fs', () => ({
    existsSync: () => false,
    readFileSync: (path: string) => {
        if (path === 'template.md') return fsState.template;
        return '';
    },
    writeFileSync: (_path: string, contents: string) => {
        fsState.written = contents;
    }
}));

const originalFetch = globalThis.fetch;

beforeEach(() => {
    resetCoreState();
    fsState.template = '';
    fsState.written = '';
    process.env.PROFILE_README_LOG_TO_CORE = '1';
});

afterEach(() => {
    delete process.env.PROFILE_README_LOG_TO_CORE;
    globalThis.fetch = originalFetch;
});

describe('feed runtime logging', () => {
    it('closes the action log group when feed configuration is invalid', async () => {
        const { feed } = await import('../src/widgets/feed');

        const output = await feed(
            { 'tech news': 'https://example.com/rss.xml' },
            {
                config: { select: ['missing-feed'] },
                matched: '<!--FEED-->'
            }
        );

        expect(output).toContain('Feed widget configuration error');
        expect(coreState.groups).toEqual(['Feed Widgets']);
        expect(coreState.endGroupCount).toBe(1);
    });
});

describe('wakatime runtime hardening', () => {
    it('closes the action log group when the API key is missing', async () => {
        const { wakatime } = await import('../src/widgets/wakatime');

        const output = await wakatime({
            config: {},
            matched: '<!--WAKATIME-->'
        });

        expect(output).toContain('Missing WakaTime API key');
        expect(coreState.groups).toEqual(['WakaTime Widgets']);
        expect(coreState.endGroupCount).toBe(1);
    });

    it('masks inline API keys and returns fallback output when fetch throws', async () => {
        globalThis.fetch = mock(async () => {
            throw new Error('network down');
        }) as unknown as typeof fetch;

        const { wakatime } = await import('../src/widgets/wakatime');

        const output = await wakatime({
            config: { apiKey: 'inline-secret' },
            matched: '<!--WAKATIME-->'
        });

        expect(coreState.secrets).toContain('inline-secret');
        expect(output).toContain('Could not load WakaTime stats');
        expect(coreState.endGroupCount).toBe(1);
    });
});

describe('main runner logging', () => {
    it('masks action input secrets and avoids logging raw widget markup', async () => {
        fsState.template = '<!--TIMESTAMP:{"label":"Now"}-->';
        coreState.inputs = {
            feed: '',
            github_token: 'gh-secret',
            readme: 'README.md',
            template: 'template.md',
            username: 'ItzDabbzz',
            wakatime_key: 'waka-secret'
        };

        const { run } = await import('../src/index');

        await run();

        const joinedLogs = coreState.infos.join('\n');

        expect(coreState.secrets).toContain('gh-secret');
        expect(coreState.secrets).toContain('waka-secret');
        expect(joinedLogs).not.toContain('<!--TIMESTAMP');
        expect(joinedLogs).not.toContain('waka-secret');
        expect(fsState.written).not.toContain('<!--TIMESTAMP');
    });
});
