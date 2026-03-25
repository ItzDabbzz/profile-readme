import Parser, { Item } from 'rss-parser';
import { URL } from 'url';
import { capitalize, pickRandomItems } from '../helpers';
import { Widget } from '../widget';

/**
 * Configuration options for the RSS feed widget.
 */
export interface FeedConfig {
    /** Maximum number of feed items to display. */
    rows?: number;

    /** Render raw markdown list instead of table format. */
    raw?: boolean;

    /** List of feed names to include (filters `subscribe`). */
    select?: string[];

    /** Randomize the order of feed items. */
    shuffle?: boolean;

    /** Whether to render a title/header above the feed. */
    title?: boolean;
}

/**
 * Sanitizes a string for Markdown table cells.
 * - Removes line breaks
 * - Escapes pipe characters
 * - Trims whitespace
 * - Optionally truncates long strings
 */
function sanitizeForTable(str: string, maxLength = 120): string {
    if (!str) return '';
    let clean = str
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
    if (clean.length > maxLength) clean = clean.slice(0, maxLength) + '…';
    return clean;
}

/**
 * Serializes a single RSS item into Markdown.
 *
 * @param item - RSS item from rss-parser
 * @param index - Display index (1-based)
 * @param raw - Whether to render raw list instead of table
 */
function serialize(item: Item, index: number, raw?: boolean) {
    const title = sanitizeForTable(item.title || 'Untitled');
    const link = new URL(item.link || 'https://www.youtube.com/watch?v=oHg5SJYRHA0');
    const hostname = sanitizeForTable(link.hostname);

    if (raw) {
        return `${index}. [${title}](${link.href}) ([${hostname}](${link.origin}))`;
    } else {
        return `| ${index} | [${title}](${link.href}) | [${hostname}](${link.origin}) |`;
    }
}

/**
 * Fetches and renders an RSS feed as a Markdown widget.
 *
 * @param subscribe - Map of feed names to RSS URLs
 * @param widget - Widget instance containing configuration
 */
export async function feed(subscribe: { [key: string]: string }, widget: Widget<FeedConfig>) {
    let feeds = Object.entries(subscribe);

    // Filter selected feeds if provided
    if (widget.config.select && widget.config.select.length > 0) {
        feeds = feeds.filter(([name]) => widget.config.select!.includes(name));
    }

    // Randomly pick one feed
    const [feedName, feedUrl] = pickRandomItems(feeds, 1)[0];

    const parser = new Parser();
    const result = await parser.parseURL(feedUrl);

    let items = result.items || [];

    // Shuffle items if enabled
    if (widget.config.shuffle) {
        items = items
            .map(item => ({ sort: Math.random(), value: item }))
            .sort((a, b) => a.sort - b.sort)
            .map(a => a.value);
    }

    // Limit number of items
    items = items.slice(0, widget.config.rows ?? 5);

    // Serialize items
    let content = items.map((item, idx) => serialize(item, idx + 1, widget.config.raw)).join('\n');

    // Add table header if not raw
    if (!widget.config.raw) {
        content = '|Index|Posts|Domain|\n|---|---|---|\n' + content;
    }

    // Add feed title if enabled
    if (widget.config.title) {
        const emoji = pickRandomItems(['📰', '📋', '📑', '📖', '🔖'], 1)[0];
        content = `### ${emoji} ${feedName}\n> Generated from feed [here](${feedUrl}). Add it to your RSS reader!\n\n---\n${content}`;
    }

    return content;
}
