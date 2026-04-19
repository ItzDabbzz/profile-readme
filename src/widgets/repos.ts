import * as core from '@actions/core';
import moment from 'moment';
import { Widget } from '../widget';

/**
 * Configuration options for the repositories widget.
 */
export interface ReposConfig {
    /** Render raw/compact output (disables rich markdown formatting). */
    raw: boolean;

    /** Maximum number of repositories to display. */
    rows: number;

    /** Field used for sorting (e.g., "stars", "forks", "updated"). */
    sort: string;

    /** Sort order direction. */
    order: 'asc' | 'desc';

    /** Show repository description. */
    showDescription: boolean;

    /** Show primary language. */
    showLanguage: boolean;

    /** Show fork count. */
    showForks: boolean;

    /** Show star count. */
    showStars: boolean;

    /** Include archived repositories. */
    showArchived: boolean;

    /** Include forked repositories. */
    showForks_repos: boolean;

    /** Use shields.io badges instead of plain text. */
    showBadges: boolean;

    /** Minimum number of stars required to include a repo. */
    minStars: number;

    /** Filter repositories by topic. */
    topic: string;

    /** List of repository full names to exclude. */
    exclude: string[];

    /** Output style. */
    style: 'table' | 'list' | 'compact';
}

/**
 * Mapping of programming languages to badge colors.
 */
const LANGUAGE_COLOR: Record<string, string> = {
    TypeScript: '3178c6',
    JavaScript: 'f7df1e',
    Python: '3572A5',
    Rust: 'dea584',
    Go: '00ADD8',
    Java: 'b07219',
    'C++': 'f34b7d',
    'C#': '178600',
    Ruby: '701516',
    Swift: 'F05138',
    Kotlin: 'A97BFF',
    PHP: '4F5D95',
    Shell: '89e051',
    HTML: 'e34c26',
    CSS: '563d7c',
    Lua: '000080',
    Dart: '00B4AB',
    Elixir: '6e4a7e',
    Zig: 'ec915c',
    Haskell: '5e5086',
    'N/A': '000000'
};

/**
 * Mapping of programming languages to representative emojis.
 */
const LANGUAGE_EMOJI: Record<string, string> = {
    TypeScript: '📘',
    JavaScript: '📙',
    Python: '🐍',
    Rust: '🦀',
    Go: '🐹',
    Java: '☕',
    'C++': '⚙️',
    'C#': '💜',
    Ruby: '💎',
    Swift: '🍎',
    Kotlin: '🟣',
    PHP: '🐘',
    Shell: '🐚',
    HTML: '🌐',
    CSS: '🎨',
    Lua: '🌙',
    Dart: '🎯',
    Elixir: '💧',
    Zig: '⚡',
    Haskell: 'λ',
    'N/A': '❌'
};

/**
 * Comparator functions for sorting repositories.
 */
const comparators: Record<string, (a: any, b: any) => number> = {
    stars: (a, b) => b.stargazers_count - a.stargazers_count,
    forks: (a, b) => b.forks_count - a.forks_count,
    created: (a, b) => moment(b.created_at).diff(moment(a.created_at)),
    updated: (a, b) => moment(b.updated_at).diff(moment(a.updated_at)),
    pushed: (a, b) => moment(b.pushed_at).diff(moment(a.pushed_at)),
    full_name: (a, b) => b.full_name.localeCompare(a.full_name),
    size: (a, b) => b.size - a.size
};

/**
 * Generates a stars badge for a repository.
 */
function starsBadge(item: any): string {
    return `![Stars](https://img.shields.io/github/stars/${item.full_name}?style=flat-square&color=e3b341&labelColor=1c2128&label=⭐)`;
}

/**
 * Generates a forks badge for a repository.
 */
function forksBadge(item: any): string {
    return `![Forks](https://img.shields.io/github/forks/${item.full_name}?style=flat-square&color=56d364&labelColor=1c2128&label=🍴)`;
}

/**
 * Generates a language badge using shields.io.
 *
 * @param item - Repository object
 * @returns Markdown badge string or empty if no language
 */
function languageBadge(item: any): string {
    var lang = item.language;
    if (!lang) lang = 'N/A';
    const color = LANGUAGE_COLOR[lang] ?? '555';
    return `![${lang}](https://img.shields.io/badge/${encodeURIComponent(lang)}-${color}?style=flat-square)`;
}

/**
 * Generates a plain text language label with emoji.
 *
 * @param item - Repository object
 * @returns Language string (e.g., "🐍 `Python`")
 */
function languageText(item: any): string {
    var lang = item.language;
    if (!lang) lang = 'N/A';
    const emoji = LANGUAGE_EMOJI[lang] ?? '💻';
    return `${emoji} \`${lang}\``;
}

/**
 * Serializes a repository into a markdown row/line based on configuration.
 *
 * Handles all output styles:
 * - `"table"`   → Markdown table row with emoji, link, stars/forks, and description columns
 * - `"list"`    → Bullet list entry with optional badges and blockquote description
 * - `"compact"` → Single-line plaintext summary (also used when `raw` is true)
 *
 * Raw mode overrides `style` and always produces compact output.
 *
 * @param item - GitHub repository object from the API response
 * @param config - Partial widget configuration (defaults applied internally)
 * @returns Markdown string for a single repository — no trailing newline
 */
function serialize(item: any, config: Partial<ReposConfig>): string {
    const raw = config.raw ?? false;
    const showStars = config.showStars ?? true;
    const showDesc = config.showDescription ?? true;
    const showLang = config.showLanguage ?? false;
    const showForks = config.showForks ?? false;
    const showBadges = config.showBadges ?? true;
    const style = config.style ?? 'table';
    const archived = item.archived ? (raw ? ' [archived]' : ' _(archived)_') : '';
    const desc = showDesc && item.description && item.description !== 'null' ? '`' + item.description + '`' : '';

    if (raw || style === 'compact') {
        const stars = showStars ? ` ⭐ ${item.stargazers_count}` : '';
        const forks = showForks ? ` 🍴 ${item.forks_count}` : '';
        const lang = showLang && item.language ? ` [${item.language}]` : '';
        const descStr = desc ? ` — ${desc}` : '';
        // No trailing \n — repos() joins lines with \n itself
        return `📦 ${item.full_name}${stars}${forks}${lang}${archived}${descStr}`;
    }

    if (style === 'list') {
        const repoLink = `**[${item.full_name}](${item.html_url})**${archived}`;
        const stars = showStars ? (showBadges ? ` ${starsBadge(item)}` : ` ⭐ \`${item.stargazers_count}\``) : '';
        const forks = showForks ? (showBadges ? ` ${forksBadge(item)}` : ` 🍴 \`${item.forks_count}\``) : '';
        const lang = showLang ? (showBadges ? ` ${languageBadge(item)}` : ` ${languageText(item)}`) : '';
        const descStr = desc ? `\n  > ${desc}` : '';
        return `* ${repoLink}${stars}${forks}${lang}${descStr}`;
    }

    // table style (default)
    const repoCell = `[${item.full_name}](${item.html_url})${archived}`;
    const starsCell = showStars ? (showBadges ? starsBadge(item) : `⭐ \`${item.stargazers_count}\``) : '';
    const forksCell = showForks ? (showBadges ? forksBadge(item) : `🍴 \`${item.forks_count}\``) : '';
    const langCell = showLang ? (showBadges ? languageBadge(item) : languageText(item)) : '';
    const descCell = desc;
    if (config.showLanguage) {
        return `| 📦 | ${repoCell} | ${starsCell}${forksCell} | ${langCell} | ${descCell} |`;
    } else {
        return `| 📦 | ${repoCell} | ${starsCell}${forksCell} | ${descCell} |`;
    }
}

/**
 * Renders a GitHub repositories widget as a Markdown string.
 *
 * ## Filtering pipeline (applied in order)
 * 1. Remove private repositories
 * 2. Remove entries matching the `exclude` list
 * 3. Remove archived repos (unless `showArchived` is true)
 * 4. Remove forked repos (unless `showForks_repos` is true)
 * 5. Apply `minStars` threshold
 * 6. Apply `topic` filter
 * 7. Sort by `sort` field in `order` direction
 * 8. Slice to `rows`
 *
 * ## Output styles
 * - `"table"`   → Markdown table with header row (default)
 * - `"list"`    → Bullet list with optional badges
 * - `"compact"` → Plain single-line entries (also forced when `raw` is true)
 *
 * @param repositories - GitHub API response object with a `data` array of repo objects
 * @param widget - Widget instance containing {@link ReposConfig} configuration
 * @returns Rendered Markdown string
 */
export function repos(repositories: any, widget: Widget<ReposConfig>): string {
    core.startGroup('Repo Widgets');
    try {
        const config = widget.config;
        const sortKey = config.sort ?? 'stars';
        const order = config.order ?? 'desc';
        const exclude = config.exclude ?? [];
        const style = config.raw ? 'compact' : (config.style ?? 'table');

        const comparator = comparators[sortKey] ?? comparators.stars;
        const directed = order === 'asc' ? (a: any, b: any) => -comparator(a, b) : comparator;

        const filtered = (repositories.data as any[])
            .filter(item => !item.private)
            .filter(item => !exclude.includes(item.full_name))
            .filter(item => (config.showArchived ? true : !item.archived))
            .filter(item => (config.showForks_repos ? true : !item.fork))
            .filter(item => (config.minStars != null ? item.stargazers_count >= config.minStars : true))
            .filter(item => (config.topic ? (item.topics ?? []).includes(config.topic) : true))
            .sort(directed)
            .slice(0, config.rows ?? 5);

        const lines = filtered.map(item => serialize(item, config));
        const output =
            style === 'compact'
                ? lines.join('\n\n') // blank line between compact items
                : lines.join('\n'); // single newline for table rows / list items

        core.info(`Generated ${filtered.length} repositories with style "${style}".`);

        if (style === 'table') {
            return config.showLanguage
                ? `| | Repo | Stars | Lang | Description |\n|---|---|---|---|---|\n${output}`
                : `| | Repo | Stars | Description |\n|---|---|---|---|\n${output}`;
        }

        return output;
    } finally {
        core.endGroup();
    }
}
