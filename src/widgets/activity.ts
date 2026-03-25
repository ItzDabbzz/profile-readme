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
    return `![${b.label}](https://img.shields.io/badge/${encodeURIComponent(b.label)}-${b.color}?style=flat-square)`;
}

/**
 * Formats a date based on widget configuration.
 *
 * @param date - ISO date string
 * @param config - Partial widget config
 * @returns Formatted date string or empty string if disabled
 */
function formatDate(date: string, config: Partial<ActivityConfig>): string {
    if (!config.showDate || !date) return '';
    const fmt =
        config.dateFormat && config.dateFormat !== 'relative'
            ? moment(date).format(config.dateFormat)
            : moment(date).fromNow();
    return fmt;
}

/**
 * Builds a repository display string.
 */
function repoLink(repoName: string, raw: boolean, showLinks: boolean): string {
    if (raw || !showLinks) return repoName;
    return `**[${repoName}](https://github.com/${repoName})**`;
}

/**
 * Builds an issue link or plain reference.
 */
function issueLink(repoName: string, num: number, raw: boolean, showLinks: boolean): string {
    if (raw || !showLinks) return `#${num}`;
    return `[#${num}](https://github.com/${repoName}/issues/${num})`;
}

/**
 * Builds a pull request link or plain reference.
 */
function prLink(repoName: string, num: number, raw: boolean, showLinks: boolean): string {
    if (raw || !showLinks) return `#${num}`;
    return `[#${num}](https://github.com/${repoName}/pull/${num})`;
}

/**
 * Builds a release link or plain label.
 */
function releaseLink(repoName: string, tag: string, name: string, raw: boolean, showLinks: boolean): string {
    const label = name || tag;
    if (raw || !showLinks) return `"${label}"`;
    return `[\`${label}\`](https://github.com/${repoName}/releases/tag/${tag})`;
}

/**
 * Normalized representation of an activity event for rendering.
 */
interface SerializedEvent {
    /** Emoji representing the event type */
    emoji: string;

    /** Badge markdown string */
    badgeStr: string;

    /** Human-readable description */
    description: string;

    /** Repository display string */
    repo: string;

    /** Formatted date string */
    date: string;
}

/**
 * Serializers convert raw GitHub API events into display-ready data.
 */

const serializers = {
    IssueCommentEvent: item => {
        return `🗣 Commented on #${item.payload.issue.number} in ${item.repo.name}`;
    },
    IssuesEvent: item => {
        return `❗️ ${capitalize(item.payload.action)} issue #${item.payload.issue.number} in ${item.repo.name}`;
    },
    PullRequestEvent: item => {
        const emoji = item.payload.action === 'opened' ? '💪' : '❌';
        const line = item.payload.pull_request.merged ? '🎉 Merged' : `${emoji} ${capitalize(item.payload.action)}`;
        return `${line} PR #${item.payload.pull_request.number} in ${item.repo.name}`;
    },
    ForkEvent: item => {
        return `🍴 Forked ${item.payload.forkee.full_name} from ${item.repo.name}`;
    },
    ReleaseEvent: item => {
        return `📦 Released "${item.payload.release.name}" in ${item.repo.name}`;
    },
    PushEvent: item => {
        const commits = item.payload.size > 1 ? `${item.payload.size} commits` : `${item.payload.size} commit`;
        return `⬆️ Pushed ${commits} to ${item.repo.name}`;
    }
};

function serialize(item, raw: boolean | undefined): string {
    const res = serializers[item.type](item);
    if (raw) return res;
    return `* ${res}`;
}

/**
 * Converts a raw GitHub event into a serialized display object.
 *
 * @param item - Raw GitHub event
 * @param config - Widget configuration
 */
function buildEvent(item: any, config: Partial<ActivityConfig>): SerializedEvent {
    const raw = config.raw ?? false;
    const showLinks = config.showLinks ?? true;
    const b = EVENT_BADGE[item.type] ?? { emoji: '•', label: item.type, color: '888' };
    const { description, repo } = serializers[item.type](item, raw, showLinks);
    return {
        emoji: b.emoji,
        badgeStr: badge(item.type),
        description,
        repo,
        date: formatDate(item.created_at, config)
    };
}

/**
 * Renders events as a markdown table.
 */
function renderTable(events: SerializedEvent[], showDate: boolean): string {
    const dateHeader = showDate ? ' When |' : '';
    const dateSep = showDate ? ':---|' : '';
    let out = `| | Event | Repo |${dateHeader}\n|---|---|---|${dateSep}\n`;
    for (const e of events) {
        const dateCell = showDate && e.date ? ` \`${e.date}\` |` : showDate ? ' — |' : '';
        out += `| ${e.badgeStr} | ${e.description} | ${e.repo} |${dateCell}\n`;
    }
    return out.trim();
}

/**
 * Renders events as a markdown bullet list.
 */
function renderList(events: SerializedEvent[], showDate: boolean): string {
    return events
        .map(e => {
            const date = showDate && e.date ? ` — \`${e.date}\`` : '';
            return `* ${e.badgeStr} ${e.description} in ${e.repo}${date}`;
        })
        .join('\n');
}

/**
 * Renders events in a compact single-line format.
 */
function renderCompact(events: SerializedEvent[], showDate: boolean): string {
    return events
        .map(e => {
            const date = showDate && e.date ? ` \`${e.date}\`` : '';
            return `${e.emoji} ${e.description} in ${e.repo}${date}`;
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
    const config = widget.config;
    const supportedTypes = Object.keys(serializers);
    const include = config.include ?? supportedTypes;
    const exclude = config.exclude ?? [];
    const style = config.raw ? 'compact' : (config.style ?? 'table');
    const showDate = config.showDate ?? false;

    const filtered = (events.data as any[])
        .filter(event => Object.prototype.hasOwnProperty.call(serializers, event.type))
        .filter(event => include.includes(event.type))
        .filter(event => !exclude.includes(event.type))
        .slice(0, config.rows ?? 10);

    if (config.groupByRepo) {
        const grouped = new Map<string, any[]>();
        for (const event of filtered) {
            const key = event.repo.name;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(event);
        }
        return Array.from(grouped.entries())
            .map(([repo, items]) => {
                const header = `### 📁 [${repo}](https://github.com/${repo})`;
                const built = items.map(item => buildEvent(item, config));
                const body =
                    style === 'list'
                        ? renderList(built, showDate)
                        : style === 'compact'
                          ? renderCompact(built, showDate)
                          : renderTable(built, showDate);
                return `${header}\n${body}`;
            })
            .join('\n\n');
    }

    const built = filtered.map(item => buildEvent(item, config));
    if (style === 'list') return renderList(built, showDate);
    if (style === 'compact') return renderCompact(built, showDate);
    return renderTable(built, showDate);
}
