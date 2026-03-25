import { Widget } from '../widget';
import * as core from '@actions/core';

/* =========================
   CONFIG (INPUT = OPTIONAL)
========================= */

/**
 * Configuration options for the WakaTime widget.
 */
export interface WakaTimeConfig {
    /** WakaTime API key (or uses `INPUT_WAKATIME_KEY` env variable). */
    apiKey?: string;

    /** Time range for stats. */
    range?: 'last_7_days' | 'last_30_days' | 'last_6_months' | 'last_year';

    /** Toggle visibility of sections. */
    showLanguages?: boolean;
    showEditors?: boolean;
    showOS?: boolean;
    showProjects?: boolean;

    /** Maximum number of rows per section. */
    rows?: number;

    /** Display badges instead of plain text labels. */
    showBadges?: boolean;

    /** Show formatted time (e.g., "2h 30m"). */
    showTime?: boolean;

    /** Show percentage values. */
    showPercent?: boolean;

    /** Output style for sections. */
    style?: 'table' | 'list' | 'compact';

    /** Show summary badges at the top. */
    showSummary?: boolean;

    /** Show highlight insights (e.g., top language). */
    showHighlights?: boolean;
}

/* =========================
   RESOLVED CONFIG (SAFE)
========================= */

/**
 * Fully resolved configuration with defaults applied.
 */
type ResolvedConfig = {
    apiKey: string;
    range: 'last_7_days' | 'last_30_days' | 'last_6_months' | 'last_year';

    showLanguages: boolean;
    showEditors: boolean;
    showOS: boolean;
    showProjects: boolean;

    rows: number;

    showBadges: boolean;
    showTime: boolean;
    showPercent: boolean;

    style: 'table' | 'list' | 'compact';

    showSummary: boolean;
    showHighlights: boolean;
};

/* =========================
   DEFAULT RESOLVER
========================= */

/**
 * Resolves user-provided configuration into a fully defined config.
 *
 * - Applies default values
 * - Falls back to environment variable for API key
 *
 * @param input - Partial configuration
 * @returns Fully resolved configuration
 */
function resolveConfig(input: WakaTimeConfig): ResolvedConfig {
    const apiKey = input.apiKey || process.env.WAKATIME_KEY || '';

    core.info(`Using WakaTime API Key: ${apiKey ? '***' + apiKey.slice(-4) : 'None'}`);

    return {
        apiKey,
        range: input.range ?? 'last_7_days',

        showLanguages: input.showLanguages ?? true,
        showEditors: input.showEditors ?? true,
        showOS: input.showOS ?? true,
        showProjects: input.showProjects ?? false,

        rows: input.rows ?? 5,

        showBadges: input.showBadges ?? true,
        showTime: input.showTime ?? true,
        showPercent: input.showPercent ?? true,

        style: input.style ?? 'table',

        showSummary: input.showSummary ?? true,
        showHighlights: input.showHighlights ?? true
    };
}

/* =========================
   CONSTANTS
========================= */

/** Human-readable labels for each time range. */
const RANGE_LABEL: Record<ResolvedConfig['range'], string> = {
    last_7_days: 'Last 7 Days',
    last_30_days: 'Last 30 Days',
    last_6_months: 'Last 6 Months',
    last_year: 'Last Year'
};

/**
 * Optional color mapping for known languages (used in badges).
 */
const LANGUAGE_COLOR: Record<string, string> = {
    TypeScript: '3178c6',
    JavaScript: 'f7df1e',
    Python: '3572A5',
    Rust: 'dea584',
    Go: '00ADD8'
};

/* =========================
   HELPERS
========================= */

/**
 * Formats a duration (in seconds) into a human-readable string.
 *
 * @example
 * formatTime(3660) // "1h 1m"
 */
function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (!h) return `${m}m`;
    if (!m) return `${h}h`;
    return `${h}h ${m}m`;
}

/**
 * Generates a text-based progress bar.
 *
 * @param percent - Value between 0–100
 * @param width - Total width of the bar
 * @returns Progress bar string (█/░ characters)
 */
function progressBar(percent: number, width = 20): string {
    const filled = Math.round((percent / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * Generates a shields.io badge markdown string.
 *
 * @param label - Badge label
 * @param value - Badge value
 * @param color - Badge color (hex without #)
 */
function badge(label: string, value: string, color = '58a6ff') {
    return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;
}

/* =========================
   TYPES
========================= */

/**
 * Normalized stat item returned from WakaTime API.
 */
interface StatItem {
    /** Display name (e.g., language/editor name). */
    name: string;

    /** Total time spent in seconds. */
    total_seconds: number;

    /** Percentage usage (0–100). */
    percent: number;
}

/* =========================
   RENDER SECTION
========================= */

/**
 * Renders a single stats section (e.g., Languages, Editors).
 *
 * Supports multiple styles:
 * - `"table"`   → Markdown table
 * - `"list"`    → Bullet list
 * - `"compact"` → Minimal inline format
 *
 * @param title - Section title
 * @param items - List of stat items
 * @param config - Resolved widget configuration
 * @returns Markdown string for the section
 */
function renderSection(title: string, items: StatItem[], config: ResolvedConfig): string {
    const header = `### ${title}`;

    if (config.style === 'compact') {
        return [
            header,
            ...items.map(
                i =>
                    `\`${i.name}\` ${config.showTime ? formatTime(i.total_seconds) : ''} \`${progressBar(i.percent, 10)}\` ${config.showPercent ? i.percent.toFixed(1) + '%' : ''}`
            )
        ].join('\n');
    }

    if (config.style === 'list') {
        return [
            header,
            ...items.map(
                i =>
                    `- **${i.name}** ${config.showTime ? `(${formatTime(i.total_seconds)})` : ''} \`${progressBar(i.percent)}\` ${config.showPercent ? i.percent.toFixed(1) + '%' : ''}`
            )
        ].join('\n');
    }

    // TABLE
    let out = `${header}
| Name | Time | Usage |
|------|------|-------|
`;

    for (const i of items) {
        const name = config.showBadges ? badge(i.name, '', LANGUAGE_COLOR[i.name] ?? '58a6ff') : `\`${i.name}\``;

        out += `| ${name} | ${config.showTime ? formatTime(i.total_seconds) : ''} | \`${progressBar(i.percent)}\` ${config.showPercent ? i.percent.toFixed(1) + '%' : ''} |\n`;
    }

    return out;
}

/* =========================
   MAIN
========================= */

/**
 * Fetches WakaTime stats and renders a markdown widget.
 *
 * Features:
 * - Multiple sections (languages, editors, OS, projects)
 * - Configurable display styles
 * - Optional summary and highlights
 * - Shields.io badge integration
 *
 * @param widget - Widget instance containing WakaTime configuration
 * @returns Rendered markdown string
 *
 * @remarks
 * Requires a valid WakaTime API key. If missing or invalid,
 * a warning/error message is returned instead of data.
 *
 * @example
 * ```ts
 * const output = await wakatime(widget);
 * console.log(output);
 * ```
 */
export async function wakatime(widget: Widget<WakaTimeConfig>): Promise<string> {
    const config = resolveConfig(widget.config);

    if (!config.apiKey) {
        core.warning('WakaTime API key is missing. Please provide it via widget config or WAKATIME_KEY environment variable.');
        return `⚠️ Missing WakaTime API key`;
    }

    const encoded = Buffer.from(config.apiKey).toString('base64');

    const res = await fetch(`https://wakatime.com/api/v1/users/current/stats/${config.range}`, {
        headers: { Authorization: `Basic ${encoded}` }
    });

    if (!res.ok) {
        core.error(`WakaTime API request failed with status ${res.status}: ${res.statusText}`);
        return `❌ API Error ${res.status}`;
    }

    const json = (await res.json()) as any;
    const data = json.data;

    const sections: string[] = [];

    /* HEADER */
    sections.push(
        `## ⏱ WakaTime Stats\n> ${RANGE_LABEL[config.range]} · **${data.human_readable_total}** · 🌍 ${data.timezone}`
    );

    /* SUMMARY */
    if (config.showSummary) {
        sections.push(
            [
                badge('Total', data.human_readable_total),
                badge('Languages', String(data.languages?.length ?? 0)),
                badge('Editors', String(data.editors?.length ?? 0))
            ].join(' ')
        );
    }

    /* HIGHLIGHTS */
    if (config.showHighlights && data.languages?.length) {
        const top = data.languages[0];
        sections.push(`## 🏆 Highlights\n- Top Language: **${top.name}** (${top.percent.toFixed(1)}%)`);
    }

    /* SECTIONS */
    if (config.showLanguages && data.languages?.length) {
        sections.push(renderSection('💬 Languages', data.languages.slice(0, config.rows), config));
    }

    if (config.showEditors && data.editors?.length) {
        sections.push(renderSection('🔥 Editors', data.editors.slice(0, config.rows), config));
    }

    if (config.showOS && data.operating_systems?.length) {
        sections.push(renderSection('🖥 OS', data.operating_systems.slice(0, config.rows), config));
    }

    if (config.showProjects && data.projects?.length) {
        sections.push(renderSection('📁 Projects', data.projects.slice(0, config.rows), config));
    }

    core.info(`WakaTime widget generated successfully with ${sections.length} sections.`);
    return sections.join('\n\n');
}
