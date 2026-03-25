import { capitalize, pickRandomItems } from "../helpers";
import Parser, { Item } from "rss-parser";
import { Widget } from "../widget";
import { URL } from "url";

/**
 * Configuration options for the RSS feed widget.
 */
export interface FeedConfig {
  /** Maximum number of feed items to display. */
  rows: number;

  /** Render raw markdown list instead of table format. */
  raw: boolean;

  /** List of feed names to include (filters `subscribe`). */
  select: string[];

  /** Randomize the order of feed items. */
  shuffle: boolean;

  /** Whether to render a title/header above the feed. */
  title: boolean;
}

/**
 * Serializes a single RSS item into markdown.
 *
 * @param item - RSS item from rss-parser
 * @param index - Display index (1-based)
 * @param raw - Whether to render in raw (list) format instead of table row
 * @returns Markdown string representing the item
 */
function serialize(item: Item, index: number, raw: boolean | undefined) {
  let title = item
    .title!.split("\n")
    .join("")
    .trim();

  const link = new URL(
    item.link! || "https://www.youtube.com/watch?v=oHg5SJYRHA0"
  );

  if (raw) {
    return `${index}. [${title}](${link.href}) ([${link.hostname}](${link.origin}))`;
  } else {
    return `| ${index} | [${title}](${link.href})  | [${link.hostname}](${link.origin}) |`;
  }
}

/**
 * Fetches and renders an RSS feed as a markdown widget.
 *
 * - Randomly selects one feed from the provided `subscribe` map
 * - Optionally filters feeds using `config.select`
 * - Supports shuffling, truncation, and multiple output formats
 *
 * @param subscribe - Map of feed names to RSS URLs
 * @param widget - Widget instance containing rendering configuration
 *
 * @returns Markdown string representing the rendered feed
 *
 * @example
 * ```ts
 * const output = await feed(
 *   { "Tech": "https://example.com/rss.xml" },
 *   widget
 * );
 * ```
 */
export async function feed(
  subscribe: { [key: string]: string },
  widget: Widget<FeedConfig>
) {
  let feeds = Object.entries(subscribe);

  // Filter selected feeds if specified
  if (widget.config.select) {
    feeds = feeds.filter(([name]) => widget.config.select!.includes(name));
  }

  // Randomly pick one feed
  const [name, url] = pickRandomItems(feeds, 1)[0];
  const feed = new Parser();

  // Fetch and parse RSS feed
  let result = await feed.parseURL(url);

  // Shuffle items if enabled
  if (widget.config.shuffle) {
    result.items = result
      .items!.map((a) => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.value);
  }

  // Limit number of items
  result.items = result.items!.slice(0, widget.config.rows ?? 5);

  // Serialize items
  let content = result.items
    .map((item, index) => serialize(item, index + 1, widget.config.raw))
    .join("\n");

  // Add table header if not raw
  if (!widget.config.raw) {
    content = "|Index|Posts|Domain|\n|---|---|---|---|\n" + content;
  }

  // Add title/header if enabled
  if (widget.config.title) {
    const contentTitle = `${
      pickRandomItems(["📰", "📋", "📑", "📖", "🔖"], 1)[0]
    } ${name}`;
    content = `### ${contentTitle}\n > This is generated from feed provided [here](${url}). Add it to your rss reader! \n\n --- \n ${content}`;
  }

  return content;
}