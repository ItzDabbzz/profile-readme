import * as core from '@actions/core';
import moment from 'moment';
import { capitalize } from '../helpers';
import { Widget } from '../widget';

/**
 * Configuration options for the activity widget.
 */
export interface ActivityConfig {
    /** Render raw text (no markdown links, forces compact mode). */
    raw: boolean;

    /** Maximum number of events to display. */
    rows: number;

    /** Event types to exclude (e.g. "PushEvent"). */
    exclude: string[];

    /** Event types to include (defaults to all supported). */
    include: string[];

    /** Whether to display event timestamps. */
    showDate: boolean;

    /**
     * Date format string.
     * - Uses moment.js formatting
     * - Use `"relative"` for human-readable (e.g. "2 hours ago")
     */
    dateFormat: string;

    /** Whether to render links to GitHub resources. */
    showLinks: boolean;

    /** Group events under repository headers. */
    groupByRepo: boolean;

    /** Output style format. */
    style: 'table' | 'list' | 'compact';

    /**
     * Custom mappings for event actions.
     * Format: { [eventType: string]: { [githubAction: string]: string } }
     * Example: { 'IssuesEvent': { 'opened': 'created', 'closed': 'resolved' } }
     */
    actionMappings?: Record<string, Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Event Badge Map
// ---------------------------------------------------------------------------

/**
 * Mapping of all supported GitHub event types to badge display metadata.
 *
 * @see https://docs.github.com/en/rest/using-the-rest-api/github-event-types
 */
const EVENT_BADGE: Record<string, { label: string; color: string; emoji: string }> = {
    CommitCommentEvent: { label: 'comment', color: '79c0ff', emoji: '💬' },
    CreateEvent: { label: 'create', color: '58a6ff', emoji: '🌿' },
    DeleteEvent: { label: 'delete', color: 'f85149', emoji: '🗑️' },
    ForkEvent: { label: 'fork', color: '56d364', emoji: '🍴' },
    GollumEvent: { label: 'wiki', color: '8b949e', emoji: '📖' },
    IssueCommentEvent: { label: 'comment', color: '79c0ff', emoji: '🗣️' },
    IssuesEvent: { label: 'issue', color: 'e4e669', emoji: '❗' },
    MemberEvent: { label: 'member', color: 'a371f7', emoji: '👥' },
    PublicEvent: { label: 'public', color: '3fb950', emoji: '🎉' },
    PullRequestEvent: { label: 'PR', color: 'a371f7', emoji: '🔀' },
    PullRequestReviewEvent: { label: 'review', color: 'f0883e', emoji: '👀' },
    PullRequestReviewCommentEvent: {
        label: 'review',
        color: 'f0883e',
        emoji: '💬'
    },
    PullRequestReviewThreadEvent: {
        label: 'thread',
        color: 'f0883e',
        emoji: '🧵'
    },
    PushEvent: { label: 'push', color: '4c9be8', emoji: '⬆️' },
    ReleaseEvent: { label: 'release', color: '3fb950', emoji: '🚀' },
    SponsorshipEvent: { label: 'sponsor', color: 'db61a2', emoji: '💖' },
    WatchEvent: { label: 'star', color: 'e3b341', emoji: '⭐' }
};

// ---------------------------------------------------------------------------
// Badge & Date Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a shields.io flat-square badge for a GitHub event type.
 *
 * @param type - GitHub event type string (e.g. `"PushEvent"`)
 * @returns Markdown image string, or empty string if the event type is unsupported
 */
function badge(type: string): string {
    const b = EVENT_BADGE[type];
    if (!b) return '';
    return `![${b.label}](https://img.shields.io/badge/${b.label}-${b.color}?style=flat-square)`;
}

/**
 * Formats an ISO date string based on widget configuration.
 *
 * - If `showDate` is false → returns empty string
 * - If `dateFormat` is `"relative"` or unset → returns relative time (e.g. "2 hours ago")
 * - Otherwise → formats using the provided moment.js format string
 *
 * @param date - ISO 8601 date string from the GitHub API
 * @param config - Partial widget configuration
 * @returns Formatted date string, or empty string if dates are disabled
 */
function formatDate(date: string, config: Partial<ActivityConfig>): string {
    if (!config.showDate) return '';
    if (config.dateFormat && config.dateFormat !== 'relative') {
        return moment(date).format(config.dateFormat);
    }
    return moment(date).fromNow();
}

/**
 * Resolves an action name from the payload, allowing for user-defined overrides.
 *
 * @param eventType - The GitHub event type
 * @param actionSource - The object containing the action (e.g. payload or a page)
 * @param config - Widget configuration
 * @param defaultAction - The fallback action if none is provided or found
 * @returns The resolved action string
 */
function resolveAction(
    eventType: string,
    actionSource: any,
    config: Partial<ActivityConfig>,
    defaultAction: string
): string {
    const action = actionSource.action;
    const githubAction = typeof action === 'string' && action.trim() !== '' ? action : '';

    if (githubAction === '') {
        return defaultAction;
    }

    const customAction = config.actionMappings?.[eventType]?.[githubAction];
    return customAction ?? githubAction;
}

// ---------------------------------------------------------------------------
// Link Builders
// ---------------------------------------------------------------------------

/**
 * Renders a repository name as a bold GitHub link.
 *
 * @param repoName - Full repository name (e.g. `"owner/repo"`)
 * @returns Markdown bold link string
 */
function repoLink(repoName: string, links: boolean): string {
    return links ? `**[${repoName}](https://github.com/${repoName})**` : `**${repoName}**`;
}

/**
 * Renders an issue number as a GitHub issue link.
 *
 * @param repoName - Full repository name
 * @param num - Issue number
 * @returns Markdown link string (e.g. `[#42](https://github.com/owner/repo/issues/42)`)
 */
function issueLink(repoName: string, num: number, links: boolean): string {
    return links ? `[#${num}](https://github.com/${repoName}/issues/${num})` : `#${num}`;
}

/**
 * Renders a pull request number as a GitHub PR link.
 *
 * @param repoName - Full repository name
 * @param num - Pull request number
 * @returns Markdown link string (e.g. `[#7](https://github.com/owner/repo/pull/7)`)
 */
function prLink(repoName: string, num: number, links: boolean): string {
    return links ? `[#${num}](https://github.com/${repoName}/pull/${num})` : `#${num}`;
}

/**
 * Renders a release tag as a GitHub release link.
 *
 * @param repoName - Full repository name
 * @param tag - Release tag name (e.g. `"v1.2.0"`)
 * @param name - Release display name (falls back to `tag` if empty)
 * @returns Markdown inline-code link string
 */
function releaseLink(repoName: string, tag: string, name: string, links: boolean): string {
    const label = name || tag;
    return links
        ? `[\`${label}\`](https://github.com/${repoName}/releases/tag/${encodeURIComponent(tag)})`
        : `\`${label}\``;
}

/**
 * Renders a commit SHA as a GitHub commit link (short 7-char SHA).
 *
 * @param repoName - Full repository name
 * @param sha - Full or short commit SHA
 * @returns Markdown inline-code link string
 */
function commitLink(repoName: string, sha: string, links: boolean): string {
    const short = sha.slice(0, 7);
    return links ? `[\`${short}\`](https://github.com/${repoName}/commit/${sha})` : `\`${short}\``;
}

/**
 * Renders a branch or tag ref name as a GitHub tree link.
 *
 * Strips the `"refs/heads/"` prefix from push event refs.
 *
 * @param repoName - Full repository name
 * @param ref - Full git ref string (e.g. `"refs/heads/main"`)
 * @returns Markdown inline-code link string
 */
function refLink(repoName: string, ref: string, links: boolean): string {
    const name = ref.replace(/^refs\/heads\//, '');
    return links ? `[\`${name}\`](https://github.com/${repoName}/tree/${encodeURIComponent(name)})` : `\`${name}\``;
}

/**
 * Renders a wiki page name as a GitHub wiki link.
 *
 * @param repoName - Full repository name
 * @param pageTitle - Wiki page title
 * @returns Markdown link string
 */
function wikiLink(repoName: string, pageTitle: string, links: boolean): string {
    const slug = pageTitle.replace(/\s+/g, '-');
    return links ? `[${pageTitle}](https://github.com/${repoName}/wiki/${encodeURIComponent(slug)})` : pageTitle;
}

// ---------------------------------------------------------------------------
// Event Description
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable description for a GitHub API event object.
 *
 * Covers all event types documented in the GitHub REST API:
 * @see https://docs.github.com/en/rest/using-the-rest-api/github-event-types
 *
 * Supported event types and example output:
 * - `CommitCommentEvent`            → "Commented on commit `abc1234` in **owner/repo**"
 * - `CreateEvent` (repository)      → "Created repository **owner/repo**"
 * - `CreateEvent` (branch/tag)      → "Created branch `main` in **owner/repo**"
 * - `DeleteEvent`                   → "Deleted branch `old-branch` in **owner/repo**"
 * - `ForkEvent`                     → "Forked **owner/repo** from **source/repo**"
 * - `GollumEvent`                   → "Edited wiki page Home in **owner/repo**" (or "Created")
 * - `IssueCommentEvent`             → "Commented on issue #12 in **owner/repo**"
 * - `IssuesEvent`                   → "Opened issue #12 in **owner/repo**"
 * - `MemberEvent`                   → "Added @username as collaborator to **owner/repo**"
 * - `PublicEvent`                   → "Made **owner/repo** public"
 * - `PullRequestEvent`              → "Opened PR #7 in **owner/repo**"
 * - `PullRequestReviewEvent`        → "Approved PR #7 in **owner/repo**"
 * - `PullRequestReviewCommentEvent` → "Commented on PR #7 review in **owner/repo**"
 * - `PullRequestReviewThreadEvent`  → "Resolved a review thread on PR #7 in **owner/repo**"
 * - `PushEvent`                     → "Pushed 3 commits to `main` in **owner/repo**"
 * - `ReleaseEvent`                  → "Published release `v1.2.0` in **owner/repo**"
 * - `SponsorshipEvent`              → "Started sponsoring @username"
 * - `WatchEvent`                    → "Starred **owner/repo**"
 *
 * Falls back to a generic description for any unrecognised event type.
 *
 * @param event - Raw GitHub event object from the Events API response
 * @returns Human-readable Markdown string describing the event
 */
function describeEvent(event: any, config: Partial<ActivityConfig>): string {
    const repo = event.repo?.name ?? 'unknown/unknown';
    const payload = event.payload ?? {};
    const links = config.showLinks ?? true;

    switch (event.type) {
        case 'CommitCommentEvent': {
            const sha = payload.comment?.commit_id ?? '';
            return sha
                ? `Commented on commit ${commitLink(repo, sha, links)} in ${repoLink(repo, links)}`
                : `Commented on a commit in ${repoLink(repo, links)}`;
        }
        case 'CreateEvent': {
            const refType: string = payload.ref_type ?? 'repository';
            const ref: string = payload.ref ?? '';
            if (refType === 'repository') return `Created repository ${repoLink(repo, links)}`;
            if (!ref) return `Created ${refType} in ${repoLink(repo, links)}`;
            return `Created ${refType} ${refLink(repo, ref, links)} in ${repoLink(repo, links)}`;
        }
        case 'DeleteEvent': {
            const refType: string = payload.ref_type ?? 'branch';
            const ref: string = payload.ref ?? '';
            if (!ref) return `Deleted ${refType} in ${repoLink(repo, links)}`;
            return `Deleted ${refType} \`${ref}\` in ${repoLink(repo, links)}`;
        }
        case 'ForkEvent': {
            const forkee = payload.forkee?.full_name ?? repo;
            return `Forked ${repoLink(repo, links)} → ${repoLink(forkee, links)}`;
        }
        case 'GollumEvent': {
            const pages: any[] = payload.pages ?? [];
            if (pages.length === 0) return `Updated wiki in ${repoLink(repo, links)}`;
            const first = pages[0];
            const action = resolveAction('GollumEvent', first, config, 'edited');
            const verb =
                action.toLowerCase() === 'created'
                    ? 'Created'
                    : action.toLowerCase() === 'edited'
                      ? 'Edited'
                      : capitalize(action);
            const pageTitle: string = first.title ?? first.page_name ?? 'a page';
            const suffix = pages.length > 1 ? ` (+${pages.length - 1} more)` : '';
            return `${verb} wiki page ${wikiLink(repo, pageTitle, links)}${suffix} in ${repoLink(repo, links)}`;
        }
        case 'IssueCommentEvent': {
            const num = payload.issue?.number;
            const isPr = !!payload.issue?.pull_request;
            if (num === undefined || num === null) return `Commented on an issue/PR in ${repoLink(repo, links)}`;

            const target = isPr ? prLink(repo, num, links) : issueLink(repo, num, links);
            const kind = isPr ? 'PR' : 'issue';
            return `Commented on ${kind} ${target} in ${repoLink(repo, links)}`;
        }
        case 'IssuesEvent': {
            const action = resolveAction('IssuesEvent', payload, config, 'updated');
            const num = payload.issue?.number;
            const title = payload.issue?.title ?? '';
            if (num === undefined || num === null) return `${capitalize(action)} issue in ${repoLink(repo, links)}`;

            const link = issueLink(repo, num, links);
            const titleStr = title ? ` — _${title}_` : '';
            return `${capitalize(action)} issue ${link}${titleStr} in ${repoLink(repo, links)}`;
        }
        case 'MemberEvent': {
            const action = resolveAction('MemberEvent', payload, config, 'added');
            const login = payload.member?.login ?? 'someone';
            return `${capitalize(action)} @${login} as collaborator to ${repoLink(repo, links)}`;
        }
        case 'PublicEvent': {
            return `Made ${repoLink(repo, links)} public`;
        }
        case 'PullRequestEvent': {
            const action = resolveAction('PullRequestEvent', payload, config, 'updated');
            const pr = payload.pull_request;
            if (!pr) return `${capitalize(action)} PR in ${repoLink(repo, links)}`;

            const num = pr.number;
            const merged = pr.merged ?? false;
            const displayAction = action === 'closed' && merged ? 'merged' : action;
            const title = pr.title ?? '';
            const titleStr = title ? ` — _${title}_` : '';
            return `${capitalize(displayAction)} PR ${prLink(repo, num, links)}${titleStr} in ${repoLink(repo, links)}`;
        }
        case 'PullRequestReviewEvent': {
            const state = payload.review?.state ?? 'reviewed';
            const num = payload.pull_request?.number;
            if (num === undefined || num === null) return `Reviewed a PR in ${repoLink(repo, links)}`;

            const stateLabel: Record<string, string> = {
                approved: 'Approved',
                changes_requested: 'Requested changes on',
                commented: 'Commented on',
                dismissed: 'Dismissed review on'
            };
            const verb = stateLabel[state] ?? 'Reviewed';
            return `${verb} PR ${prLink(repo, num, links)} in ${repoLink(repo, links)}`;
        }
        case 'PullRequestReviewCommentEvent': {
            const num = payload.pull_request?.number;
            if (num === undefined || num === null) return `Commented on a review in ${repoLink(repo, links)}`;
            return `Commented on a review of PR ${prLink(repo, num, links)} in ${repoLink(repo, links)}`;
        }
        case 'PullRequestReviewThreadEvent': {
            const action = resolveAction('PullRequestReviewThreadEvent', payload, config, 'resolved');
            const num = payload.pull_request?.number;
            if (num === undefined || num === null)
                return `${capitalize(action)} a review thread in ${repoLink(repo, links)}`;
            return `${capitalize(action)} a review thread on PR ${prLink(repo, num, links)} in ${repoLink(repo, links)}`;
        }
        case 'PushEvent': {
            // GitHub may provide either `payload.size` (total commits) or an array
            // of commit objects (`payload.commits`). Prefer the explicit array length
            // when available because `size` can be omitted for certain events.
            // If neither is provided, default to 1 as a PushEvent implies at least one commit.
            const hasExplicitCount = payload.commits != null || payload.size != null;
            const count: number = payload.commits?.length ?? payload.size ?? (payload.ref ? 1 : 0);
            const ref: string = payload.ref ?? '';
            const branch = refLink(repo, ref, links);
            const head: string = payload.head ?? '';
            const headStr = head ? ` (${commitLink(repo, head, links)})` : '';

            // When there are no commits (count === 0) we still want to show the
            // branch and, if present, the head SHA. This matches the test suite
            // expectation for a push with only a head reference.
            if (count === 0 || !hasExplicitCount) {
                return `Pushed to ${branch} in ${repoLink(repo, links)}${headStr}`;
            }

            const label = count === 1 ? 'commit' : 'commits';
            return `Pushed ${count} ${label} to ${branch} in ${repoLink(repo, links)}${headStr}`;
        }
        case 'ReleaseEvent': {
            const action = resolveAction('ReleaseEvent', payload, config, 'published');
            const release = payload.release;
            if (!release) return `${capitalize(action)} release in ${repoLink(repo, links)}`;

            const tag = release.tag_name ?? '';
            const name = release.name ?? '';
            return `${capitalize(action)} release ${releaseLink(repo, tag, name, links)} in ${repoLink(repo, links)}`;
        }
        case 'SponsorshipEvent': {
            const action = resolveAction('SponsorshipEvent', payload, config, 'started');
            const login = payload.sponsorship?.sponsorable?.login ?? 'someone';
            const verb = action.toLowerCase() === 'cancelled' ? 'Cancelled sponsorship of' : 'Started sponsoring';
            return `${verb} @${login}`;
        }
        case 'WatchEvent': {
            return `Starred ${repoLink(repo, links)}`;
        }
        default:
            return `${event.type?.replace(/Event$/, '') ?? 'Unknown activity'} in ${repoLink(repo, links)}`;
    }
}

/**
 * Normalize event into renderable object
 */
function build(event: any, config: Partial<ActivityConfig>) {
    const b = EVENT_BADGE[event.type] ?? {
        emoji: '•',
        label: event.type,
        color: '888'
    };

    return {
        emoji: b.emoji,
        badge: badge(event.type),
        description: describeEvent(event, config),
        repo: event.repo.name,
        date: formatDate(event.created_at, config)
    };
}

/**
 * RENDERERS
 */

/**
 * Renders events as a markdown table.
 */
function renderTable(events: any[], showDate: boolean, showLinks: boolean): string {
    const dateHeader = showDate ? ' When |' : '';
    const dateSep = showDate ? ':---|' : '';

    let out = `| | Event | Repo |${dateHeader}\n|---|---|---|${dateSep}\n`;

    for (const e of events) {
        const date = showDate ? ` \`${e.date || '—'}\` |` : '';
        out += `| ${e.badge} | ${e.emoji} ${e.description} | ${repoLink(e.repo, showLinks)} |${date}\n`;
    }

    return out.trim();
}

/**
 * Renders events as a markdown bullet list.
 */
function renderList(events: any[], showDate: boolean): string {
    return events
        .map(e => {
            const date = showDate && e.date ? ` — \`${e.date}\`` : '';
            return `* ${e.badge} ${e.emoji} ${e.description}${date}`;
        })
        .join('\n');
}

/**
 * Renders events in a compact single-line format.
 */
function renderCompact(events: any[], showDate: boolean): string {
    return events
        .map(e => {
            const date = showDate && e.date ? ` \`${e.date}\`` : '\n';
            return `${e.emoji} ${e.description}${date}`;
        })
        .join('\n');
}

/**
 * Main entry point for rendering GitHub activity.
 *
 * @param events - GitHub API response containing event data
 * @param widget - Widget instance with configuration
 *
 * @returns Markdown string representing the activity feed
 *
 * @example
 * ```ts
 * const output = activity(events, widget);
 * console.log(output);
 * ```
 */
export function activity(events: any, widget: Widget<ActivityConfig>): string {
    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest) core.startGroup('Activity Widgets');

    try {
        const config = widget.config;
        const supported = Object.keys(EVENT_BADGE);

        const include = config.include ?? supported;
        const exclude = config.exclude ?? [];
        const style = config.raw ? 'compact' : (config.style ?? 'table');
        const showDate = config.showDate ?? false;
        const showLinks = config.raw ? false : (config.showLinks ?? true);

        const filtered = (events.data as any[])
            .filter(e => include.includes(e.type))
            .filter(e => !exclude.includes(e.type))
            .slice(0, config.rows ?? 10);

        const built = filtered.map(e => build(e, { ...config, showLinks }));

        if (config.groupByRepo) {
            const grouped = new Map<string, any[]>();

            for (const e of built) {
                if (!grouped.has(e.repo)) grouped.set(e.repo, []);
                grouped.get(e.repo)!.push(e);
            }

            return Array.from(grouped.entries())
                .map(([repo, items]) => {
                    const header = `### 📁 ${repo}`;

                    const body =
                        style === 'list'
                            ? renderList(items, showDate)
                            : style === 'compact'
                              ? renderCompact(items, showDate)
                              : renderTable(items, showDate, showLinks);

                    return `${header}\n${body}`;
                })
                .join('\n\n');
        }

        if (style === 'list') return renderList(built, showDate);
        if (style === 'compact') return renderCompact(built, showDate);

        if (!isTest) core.info(`Rendering activity with ${built.length} events`);
        return renderTable(built, showDate, showLinks);
    } finally {
        if (!isTest) core.endGroup();
    }
}
