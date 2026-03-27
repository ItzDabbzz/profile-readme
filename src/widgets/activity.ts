import * as core from '@actions/core';
import moment from 'moment';
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
}

/**
 * Mapping of GitHub event types to badge metadata.
 */
const EVENT_BADGE: Record<string, { label: string; color: string; emoji: string }> = {
    PushEvent: { label: 'push', color: '4c9be8', emoji: '⬆️' },
    PullRequestEvent: { label: 'PR', color: 'a371f7', emoji: '🔀' },
    PullRequestReviewEvent: { label: 'review', color: 'f0883e', emoji: '👀' },
    PullRequestReviewCommentEvent: { label: 'review', color: 'f0883e', emoji: '💬' },
    IssuesEvent: { label: 'issue', color: 'e4e669', emoji: '❗' },
    IssueCommentEvent: { label: 'comment', color: '79c0ff', emoji: '🗣' },
    ForkEvent: { label: 'fork', color: '56d364', emoji: '🍴' },
    ReleaseEvent: { label: 'release', color: '3fb950', emoji: '🚀' },
    WatchEvent: { label: 'star', color: 'e3b341', emoji: '⭐' },
    CreateEvent: { label: 'create', color: '58a6ff', emoji: '🌿' },
    DeleteEvent: { label: 'delete', color: 'f85149', emoji: '🗑' },
    PublicEvent: { label: 'public', color: '3fb950', emoji: '🎉' },
    MemberEvent: { label: 'member', color: 'a371f7', emoji: '👥' },
    SponsorshipEvent: { label: 'sponsor', color: 'db61a2', emoji: '💖' }
};

/**
 * Builds a shields.io badge for a GitHub event type.
 *
 * @param type - GitHub event type
 * @returns Markdown image string or empty string if unsupported
 */
function badge(type: string): string {
    const b = EVENT_BADGE[type];
    if (!b) return '';
    return `![${b.label}](https://img.shields.io/badge/${b.label}-${b.color}?style=flat-square)`;
}

/**
 * Formats a date based on widget configuration.
 *
 * @param date - ISO date string
 * @param config - Partial widget config
 * @returns Formatted date string or empty string if disabled
 */
function formatDate(date: string, config: Partial<ActivityConfig>): string {
    if (!config.showDate) return '';
    if (config.dateFormat && config.dateFormat !== 'relative') {
        return moment(date).format(config.dateFormat);
    }
    return moment(date).fromNow();
}

/**
 * Builds a repository display string.
 */
function repoLink(repoName: string): string {
    return `**[${repoName}](https://github.com/${repoName})**`;
}

/**
 * Builds an issue link or plain reference.
 */
function issueLink(repoName: string, num: number): string {
    return `[#${num}](https://github.com/${repoName}/issues/${num})`;
}

/**
 * Builds a pull request link or plain reference.
 */
function prLink(repoName: string, num: number): string {
    return `[#${num}](https://github.com/${repoName}/pull/${num})`;
}

/**
 * Builds a release link or plain label.
 */
function releaseLink(repoName: string, tag: string, name: string): string {
    const label = name || tag;
    return `[\`${label}\`](https://github.com/${repoName}/releases/tag/${tag})`;
}

/**
 *
 * @param event Github Event
 * @returns Generated readable string
 */
function describeEvent(event: any): string {
    const repo = event.repo.name;

    switch (event.type) {
        case 'PushEvent': {
            const count = event.payload?.size ?? 0;
            const label = count === 1 ? 'commit' : 'commits';
            return `Pushed ${count} ${label}`;
        }

        case 'PullRequestEvent': {
            const pr = event.payload.pull_request;
            const action = event.payload.action;
            return `${action} PR #${pr.number}}`;
        }

        case 'IssuesEvent': {
            const issue = event.payload.issue;
            return `${event.payload.action} issue #${issue.number}`;
        }

        case 'IssueCommentEvent': {
            return `Commented on #${event.payload.issue.number}`;
        }

        case 'ForkEvent': {
            return `Forked ${repoLink(event.payload.forkee.full_name)}`;
        }

        case 'ReleaseEvent': {
            const r = event.payload;
            return `Released ${releaseLink(event.repo.name, r.release.tag_name, r.release.name)}`;
        }

        case 'WatchEvent': {
            return `Starred ${repoLink(repo)}`;
        }

        default:
            return `${event.type} in ${repoLink(repo)}`;
    }
}

/**
 * Normalize event into renderable object
 */
function build(event: any, config: Partial<ActivityConfig>) {
    const b = EVENT_BADGE[event.type] ?? { emoji: '•', label: event.type, color: '888' };

    return {
        emoji: b.emoji,
        badge: badge(event.type),
        description: describeEvent(event),
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
function renderTable(events: any[], showDate: boolean): string {
    const dateHeader = showDate ? ' When |' : '';
    const dateSep = showDate ? ':---|' : '';

    let out = `| | Event | Repo |${dateHeader}\n|---|---|---|${dateSep}\n`;

    for (const e of events) {
        const date = showDate ? ` \`${e.date || '—'}\` |` : '';
        out += `| ${e.badge} | ${e.emoji} ${e.description} | ${repoLink(e.repo)} |${date}\n`;
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
    core.startGroup('Activity Widgets');
    const config = widget.config;
    const supported = Object.keys(EVENT_BADGE);

    const include = config.include ?? supported;
    const exclude = config.exclude ?? [];
    const style = config.raw ? 'compact' : (config.style ?? 'table');
    const showDate = config.showDate ?? false;

    const filtered = (events.data as any[])
        .filter(e => supported.includes(e.type))
        .filter(e => include.includes(e.type))
        .filter(e => !exclude.includes(e.type))
        .slice(0, config.rows ?? 10);

    const built = filtered.map(e => build(e, config));

    if (config.groupByRepo) {
        const grouped = new Map<string, any[]>();

        for (const e of built) {
            if (!grouped.has(e.repo)) grouped.set(e.repo, []);
            grouped.get(e.repo)!.push(e);
        }

        return Array.from(grouped.entries())
            .map(([repo, items]) => {
                const header = `### 📁 [${repo}](https://github.com/${repo})`;

                const body =
                    style === 'list'
                        ? renderList(items, showDate)
                        : style === 'compact'
                          ? renderCompact(items, showDate)
                          : renderTable(items, showDate);

                return `${header}\n${body}`;
            })
            .join('\n\n');
    }

    if (style === 'list') return renderList(built, showDate);
    if (style === 'compact') return renderCompact(built, showDate);

    core.info(`Rendering activity with ${built.length} events`);
    core.endGroup();
    return renderTable(built, showDate);
}
