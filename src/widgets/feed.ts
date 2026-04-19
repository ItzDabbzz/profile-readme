import * as core from '@actions/core';
import Parser, { Item } from 'rss-parser';
import { URL } from 'url';
import { capitalize, pickRandomItems } from '../helpers';
import { Widget } from '../widget';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * Configuration options for the RSS feed widget.
 */
export interface FeedConfig {
    /**
     * Maximum number of feed items to display.
     * @default 5
     */
    rows?: number;

    /**
     * Render a raw markdown list instead of a table.
     * Useful for simpler layouts or feeds with long titles.
     * @default false
     */
    raw?: boolean;

    /**
     * List of feed names to include (must match keys in `subscribe`).
     * If omitted, all feeds are eligible for selection.
     * @example ["hackernews top", "hackernews ask"]
     */
    select?: string[];

    /**
     * Randomize the order of feed items before slicing.
     * @default false
     */
    shuffle?: boolean;

    /**
     * Whether to render a title/header section above the feed content.
     * @default false
     */
    title?: boolean;

    /**
     * Number of times to retry a failed fetch before giving up.
     * Only retries on transient errors (429, 5xx).
     * @default 3
     */
    retries?: number;

    /**
     * Base delay in milliseconds between retry attempts.
     * Each retry multiplies this by the attempt number (linear backoff).
     * @default 2000
     */
    retryDelay?: number;

    /**
     * Milliseconds to wait between sequential feed widget renders
     * within the same process run. Helps avoid rate limiting when
     * multiple feed widgets share the same upstream domain.
     * @default 500
     */
    requestDelay?: number;
}

/**
 * Fully resolved feed configuration with all defaults applied.
 */
type ResolvedFeedConfig = Required<FeedConfig>;

/**
 * A parsed and sanitized feed item ready for rendering.
 */
interface NormalizedItem {
    /** Display title, truncated and sanitized for Markdown. */
    title: string;
    /** Full URL of the feed item. */
    href: string;
    /** Hostname of the item URL (e.g. "github.com"). */
    hostname: string;
    /** Origin of the item URL (e.g. "https://github.com"). */
    origin: string;
}

/**
 * Metadata about a selected feed source.
 */
interface FeedSource {
    /** Human-readable name of the feed (key from `subscribe`). */
    name: string;
    /** RSS URL for the feed. */
    url: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback URL used when a feed item has no link. */
const FALLBACK_URL = 'https://www.youtube.com/watch?v=oHg5SJYRHA0';

/** Maximum character length of a title before truncation. */
const MAX_TITLE_LENGTH = 120;

/** Emojis used to decorate feed titles. */
const TITLE_EMOJIS = ['📰', '📋', '📑', '📖', '🔖'];

/**
 * Module-level result cache, keyed by feed URL.
 * Shared across all widget calls within the same process run to avoid
 * redundant HTTP requests to the same upstream source.
 */
const feedCache = new Map<string, Parser.Output<Item>>();

/**
 * Per-domain timestamps of the last successful request.
 * Used to enforce a minimum gap between requests to the same host.
 */
const domainLastFetched = new Map<string, number>();

/**
 * Clears the module-level feed cache and domain throttle timestamps.
 * Intended for use in tests only — do not call in production code.
 */
export function __resetFeedCache(): void {
    feedCache.clear();
    domainLastFetched.clear();
}

// ---------------------------------------------------------------------------
// Config Resolution
// ---------------------------------------------------------------------------

/**
 * Applies default values to a partial {@link FeedConfig} object.
 *
 * @param input - Partial configuration supplied by the user
 * @returns Fully resolved configuration with all defaults filled in
 */
function resolveConfig(input: FeedConfig): ResolvedFeedConfig {
    return {
        rows: input.rows ?? 5,
        raw: input.raw ?? false,
        select: input.select ?? [],
        shuffle: input.shuffle ?? false,
        title: input.title ?? false,
        retries: input.retries ?? 3,
        retryDelay: input.retryDelay ?? 2000,
        requestDelay: input.requestDelay ?? 500
    };
}

// ---------------------------------------------------------------------------
// Sanitization & Normalization
// ---------------------------------------------------------------------------

/**
 * Sanitizes a raw string for safe inclusion in a Markdown table cell.
 *
 * Performs the following transformations:
 * - Strips carriage returns and newlines
 * - Escapes pipe (`|`) characters
 * - Trims leading/trailing whitespace
 * - Truncates to `maxLength` characters with a trailing ellipsis
 *
 * @param str - Raw input string
 * @param maxLength - Maximum allowed character length before truncation
 * @returns Sanitized string safe for Markdown rendering
 */
function sanitizeForTable(str: string, maxLength = MAX_TITLE_LENGTH): string {
    if (!str) return '';
    let clean = str
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
    if (clean.length > maxLength) clean = clean.slice(0, maxLength) + '…';
    return clean;
}

/**
 * Extracts and normalizes the hostname from a URL string.
 * Strips the `www.` prefix for cleaner display.
 *
 * @param href - Raw URL string
 * @returns Cleaned hostname (e.g. `"github.com"`)
 */
function extractHostname(href: string): string {
    try {
        return new URL(href).hostname.replace(/^www\./, '');
    } catch {
        return href;
    }
}

/**
 * Converts a raw {@link Item} from rss-parser into a {@link NormalizedItem}
 * ready for rendering.
 *
 * Applies sanitization, fallback URL resolution, and hostname extraction.
 *
 * @param item - Raw RSS feed item
 * @returns Normalized item with sanitized fields
 */
function normalizeItem(item: Item): NormalizedItem {
    const href = item.link || FALLBACK_URL;
    let parsed: URL;

    try {
        parsed = new URL(href);
    } catch {
        parsed = new URL(FALLBACK_URL);
    }

    return {
        title: sanitizeForTable(item.title || 'Untitled'),
        href: parsed.href,
        hostname: extractHostname(parsed.hostname.replace(/^www\./, '')),
        origin: parsed.origin
    };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Renders a single {@link NormalizedItem} as a Markdown string.
 *
 * Output format depends on the `raw` flag:
 * - `raw: true`  → numbered list entry with hostname link
 * - `raw: false` → Markdown table row with index, title, and domain columns
 *
 * @param item - Normalized feed item
 * @param index - 1-based display index
 * @param raw - Whether to render as a list item instead of a table row
 * @returns Markdown string for the item
 *
 * @example
 * // raw = false
 * "| 1 | [Some Article](https://...) | [github.com](https://github.com) |"
 *
 * @example
 * // raw = true
 * "1. [Some Article](https://...) ([github.com](https://github.com))"
 */
function serializeItem(item: NormalizedItem, index: number, raw: boolean): string {
    if (raw) {
        return `${index}. [${item.title}](${item.href}) ([${item.hostname}](${item.origin}))`;
    }
    return `| ${index} | [${item.title}](${item.href}) | [${item.hostname}](${item.origin}) |`;
}

/**
 * Wraps serialized item rows in a Markdown table with a header.
 *
 * @param rows - Array of serialized table row strings
 * @returns Full Markdown table string
 */
function wrapInTable(rows: string[]): string {
    return `|Index|Posts|Domain|\n|---|---|---|\n${rows.join('\n')}`;
}

/**
 * Prepends a styled title/header section to the feed content.
 *
 * Selects a random emoji from {@link TITLE_EMOJIS} and includes the feed
 * name, source URL, and a separator above the content.
 *
 * @param content - Rendered feed content (table or list)
 * @param source - Feed source metadata (name and URL)
 * @returns Content with a title header prepended
 */
function prependTitle(content: string, source: FeedSource): string {
    const emoji = pickRandomItems(TITLE_EMOJIS, 1)[0];
    return `### ${emoji} ${source.name}\n> Generated from feed [here](${source.url}). Add it to your RSS reader!\n\n---\n${content}`;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Enforces a minimum delay between consecutive requests to the same domain.
 *
 * Reads the last fetch timestamp from {@link domainLastFetched} and sleeps
 * for the remaining time if the minimum gap has not elapsed.
 *
 * @param domain - Domain to throttle (e.g. `"hnrss.org"`)
 * @param minGapMs - Minimum milliseconds between requests to this domain
 */
async function throttleByDomain(domain: string, minGapMs: number): Promise<void> {
    const last = domainLastFetched.get(domain);
    if (last) {
        const elapsed = Date.now() - last;
        if (elapsed < minGapMs) {
            const wait = minGapMs - elapsed;
            core.info(`Throttling ${domain} — waiting ${wait}ms`);
            await new Promise(res => setTimeout(res, wait));
        }
    }
}

/**
 * Fetches and parses an RSS feed URL, with:
 * - **In-memory caching** — identical URLs are never fetched twice per run
 * - **Domain throttling** — enforces a minimum gap between same-domain requests
 * - **Retry with linear backoff** — retries on transient errors (429, 5xx only)
 *
 * On success, the result is stored in {@link feedCache} and the fetch time
 * is recorded in {@link domainLastFetched}.
 *
 * @param parser - Shared rss-parser instance
 * @param url - RSS feed URL to fetch
 * @param retries - Maximum number of retry attempts for transient failures
 * @param retryDelay - Base delay in milliseconds between retries (multiplied by attempt number)
 * @param requestDelay - Minimum milliseconds between requests to the same domain
 * @returns Parsed feed output from rss-parser
 * @throws If all retry attempts fail or the error is non-retryable (e.g. 404, parse error)
 */
async function fetchFeed(
    parser: Parser,
    url: string,
    retries: number,
    retryDelay: number,
    requestDelay: number
): Promise<Parser.Output<Item>> {
    if (feedCache.has(url)) {
        core.info(`Cache hit — skipping fetch for ${url}`);
        return feedCache.get(url)!;
    }

    let domain: string;
    try {
        domain = new URL(url).hostname;
    } catch {
        domain = url;
    }

    await throttleByDomain(domain, requestDelay);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await parser.parseURL(url);
            feedCache.set(url, result);
            domainLastFetched.set(domain, Date.now());
            return result;
        } catch (err: any) {
            const msg: string = err?.message ?? '';
            const status = parseInt(msg.match(/\d{3}/)?.[0] ?? '0', 10);
            const isRetryable = status === 429 || (status >= 500 && status < 600);
            const isLast = attempt === retries;

            if (isLast || !isRetryable) {
                core.error(`Feed fetch failed for ${url} after ${attempt} attempt(s): ${msg}`);
                throw err;
            }

            const delay = retryDelay * attempt;
            core.warning(`Feed fetch attempt ${attempt} failed (${msg}). Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    // Unreachable — TypeScript requires an explicit throw
    throw new Error(`fetchFeed: exhausted retries for ${url}`);
}

// ---------------------------------------------------------------------------
// Feed Selection
// ---------------------------------------------------------------------------

/**
 * Resolves the list of eligible feed sources from the subscribe map,
 * applying the `select` filter from config if provided.
 *
 * @param subscribe - Map of feed name → RSS URL
 * @param select - Optional list of feed names to restrict to
 * @returns Array of {@link FeedSource} objects eligible for selection
 * @throws If no feeds match the filter or the subscribe map is empty
 */
function resolveEligibleFeeds(subscribe: Record<string, string>, select: string[]): FeedSource[] {
    let entries = Object.entries(subscribe).map(([name, url]) => ({ name, url }));

    if (select.length > 0) {
        entries = entries.filter(f => select.includes(f.name));
        if (entries.length === 0) {
            throw new Error(
                `Feed widget: none of the selected feeds exist: [${select.join(', ')}]. ` +
                    `Available: [${Object.keys(subscribe).join(', ')}]`
            );
        }
    }

    if (entries.length === 0) {
        throw new Error('Feed widget: subscribe map is empty — no feeds to render.');
    }

    return entries;
}

// ---------------------------------------------------------------------------
// Item Processing
// ---------------------------------------------------------------------------

/**
 * Applies shuffle and row-limit transformations to a list of raw feed items.
 *
 * Shuffling is performed before slicing, ensuring random selection when
 * the feed has more items than `rows`.
 *
 * @param items - Raw items from the parsed RSS feed
 * @param shuffle - Whether to randomize item order
 * @param rows - Maximum number of items to return
 * @returns Processed array of raw items, ready for normalization
 */
function processItems(items: Item[], shuffle: boolean, rows: number): Item[] {
    if (shuffle) {
        items = [...items].sort(() => Math.random() - 0.5);
    }
    return items.slice(0, rows);
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Fetches and renders an RSS feed as a Markdown widget.
 *
 * ## Behavior
 * 1. Resolves eligible feeds from the `subscribe` map using `config.select`
 * 2. Randomly picks one feed from the eligible set
 * 3. Fetches the feed with caching, domain throttling, and retry logic
 * 4. Normalizes, optionally shuffles, and slices items to `config.rows`
 * 5. Serializes items into a Markdown table or list
 * 6. Optionally prepends a styled title header
 *
 * ## Error Handling
 * Non-retryable errors (e.g. 404) throw immediately after the first attempt.
 * Retryable errors (429, 5xx) are retried up to `config.retries` times with
 * linear backoff. If all retries fail, a user-friendly Markdown fallback is
 * returned instead of crashing the process.
 *
 * @param subscribe - Map of feed name → RSS URL (e.g. `{ "hackernews top": "https://hnrss.org/frontpage" }`)
 * @param widget - Widget instance containing {@link FeedConfig} configuration
 * @returns Rendered Markdown string (table, list, or error fallback message)
 *
 * @example
 * ```ts
 * const output = await feed(
 *   { "HN Top": "https://hnrss.org/frontpage" },
 *   widget
 * );
 * // => "|Index|Posts|Domain|\n|---|---|---|\n| 1 | [Article](https://...) | ... |"
 * ```
 */
export async function feed(subscribe: Record<string, string>, widget: Widget<FeedConfig>): Promise<string> {
    core.startGroup('Feed Widgets');
    try {
        const config = resolveConfig(widget.config);

        // --- Feed selection ---
        let eligible: FeedSource[];
        try {
            eligible = resolveEligibleFeeds(subscribe, config.select);
        } catch (err: any) {
            core.error(err.message);
            return `> ⚠️ Feed widget configuration error: ${err.message}`;
        }

        const source = pickRandomItems(eligible, 1)[0];
        core.info(`Selected feed: "${source.name}" → ${source.url}`);

        // --- Fetch ---
        const parser = new Parser();
        let result: Parser.Output<Item>;
        try {
            result = await fetchFeed(parser, source.url, config.retries, config.retryDelay, config.requestDelay);
        } catch (err: any) {
            return `> ⚠️ Could not load feed **${source.name}**: ${err.message}. It may be temporarily unavailable.`;
        }

        // --- Process items ---
        const rawItems = result.items ?? [];
        const processed = processItems(rawItems, config.shuffle, config.rows);

        if (processed.length === 0) {
            core.warning(`Feed "${source.name}" returned no items.`);
            return `> ⚠️ Feed **${source.name}** is currently empty.`;
        }

        // --- Normalize & serialize ---
        const normalized = processed.map(normalizeItem);
        const rows = normalized.map((item, idx) => serializeItem(item, idx + 1, config.raw));
        let content = config.raw ? rows.join('\n') : wrapInTable(rows);

        // --- Optional title ---
        if (config.title) {
            content = prependTitle(content, source);
        }

        core.info(`Generated feed widget for "${source.name}" with ${processed.length} items.`);
        return content;
    } finally {
        core.endGroup();
    }
}
