import * as core from '@actions/core';
import moment from 'moment-timezone';
import { Widget } from '../widget';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the timestamp widget.
 */
export interface TimestampConfig {
    /**
     * Custom date format string (moment.js syntax).
     * Only used when `mode` is `"format"`.
     * @see https://momentjs.com/docs/#/displaying/
     * @example "dddd, MMMM Do YYYY, h:mm A"
     */
    format?: string;

    /**
     * IANA timezone identifier.
     * Falls back to UTC if omitted or invalid.
     * @example "America/New_York"
     * @example "Europe/London"
     */
    tz?: string;

    /**
     * Output mode controlling how the timestamp is formatted.
     * - `"format"`   → Custom moment.js format (uses `format` option)
     * - `"relative"` → Human-readable relative time (e.g. "2 hours ago")
     * - `"unix"`     → Unix epoch in seconds
     * - `"iso"`      → Full ISO 8601 string
     * @default "format"
     */
    mode?: 'format' | 'relative' | 'unix' | 'iso';

    /**
     * Whether to render the output as a shields.io badge.
     * When `false`, returns the raw formatted string.
     * @default true
     */
    badge?: boolean;

    /**
     * Label text displayed on the left side of the badge.
     * Only used when `badge` is `true`.
     * @default "Updated"
     */
    label?: string;

    /**
     * Badge background color as a hex string without `#`.
     * Only used when `badge` is `true`.
     * @default "58a6ff"
     * @example "ff0000"
     */
    color?: string;
}

/**
 * Fully resolved configuration with all defaults applied.
 */
type ResolvedConfig = {
    format: string;
    tz: string | null;
    mode: 'format' | 'relative' | 'unix' | 'iso';
    badge: boolean;
    label: string;
    color: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default moment.js format string when none is provided. */
const DEFAULT_FORMAT = 'MMM D YYYY, h:mm A';

// ---------------------------------------------------------------------------
// Config Resolution
// ---------------------------------------------------------------------------

/**
 * Applies default values to a partial {@link TimestampConfig}.
 *
 * @param input - Partial configuration from the widget
 * @returns Fully resolved configuration with all fields populated
 */
function resolveConfig(input: TimestampConfig): ResolvedConfig {
    return {
        format: input.format ?? DEFAULT_FORMAT,
        tz: input.tz ?? null,
        mode: input.mode ?? 'format',
        badge: input.badge ?? true,
        label: input.label ?? 'Updated',
        color: input.color ?? '58a6ff'
    };
}

// ---------------------------------------------------------------------------
// Moment Resolution
// ---------------------------------------------------------------------------

/**
 * Returns a moment instance for the current time in the specified timezone.
 *
 * Resolution order:
 * 1. `tz` is null/empty → UTC
 * 2. `tz` is a valid IANA zone → that timezone
 * 3. `tz` is unrecognized → UTC with a warning logged
 *
 * @param tz - IANA timezone string, or null for UTC
 * @returns Moment instance representing the current time
 */
function getMoment(tz: string | null): moment.Moment {
    if (!tz) return moment.utc();
    if (moment.tz.zone(tz)) return moment().tz(tz);
    core.warning(`Timestamp widget: unrecognized timezone "${tz}" — falling back to UTC.`);
    return moment.utc();
}

// ---------------------------------------------------------------------------
// Value Generation
// ---------------------------------------------------------------------------

/**
 * Computes the timestamp value string for the given mode.
 *
 * @param now - Moment instance for the current time
 * @param mode - Output mode
 * @param format - Custom format string (only used in `"format"` mode)
 * @returns Raw timestamp string before any badge encoding
 */
function computeValue(now: moment.Moment, mode: ResolvedConfig['mode'], format: string): string {
    switch (mode) {
        case 'relative':
            return now.fromNow();
        case 'unix':
            return String(now.unix());
        case 'iso':
            return now.toISOString();
        default:
            return now.format(format);
    }
}

// ---------------------------------------------------------------------------
// Badge Rendering
// ---------------------------------------------------------------------------

/**
 * Encodes a raw value string for safe use in a shields.io badge path segment.
 *
 * Shields.io uses its own path-level escaping on top of standard URL encoding:
 * - `-` must be escaped as `--` (single `-` is a path delimiter)
 * - `_` must be escaped as `__` (single `_` is a space)
 * - Spaces are encoded as `_`
 *
 * After applying shields.io escaping, `encodeURIComponent` handles all
 * remaining special characters (`:`, `.`, `/`, etc.) so they survive the
 * URL round-trip without being misinterpreted.
 *
 * @param value - Raw timestamp string (e.g. "Mar 27 2026, 9:10 PM")
 * @returns Shields.io-safe encoded string
 *
 * @example
 * shieldsEncode("Mar 27 2026, 9:10 PM")
 * // → "Mar_27_2026%2C_9%3A10_PM"
 * // shields.io renders → "Mar 27 2026, 9:10 PM" ✓
 *
 * @example
 * shieldsEncode("2026-03-27T09:10:27.510Z")
 * // → "2026--03--27T09%3A10%3A27.510Z"
 * // shields.io renders → "2026-03-27T09:10:27.510Z" ✓
 */
function shieldsEncode(value: string): string {
    return encodeURIComponent(
        value
            .replace(/-/g, '--') // escape literal dashes (shields.io path delimiter)
            .replace(/_/g, '__') // escape literal underscores (shields.io space char)
            .replace(/\s+/g, '_') // spaces → shields.io space character
    );
}

/**
 * Generates a shields.io static badge as a Markdown image string.
 *
 * Uses the path format: `/badge/{label}-{message}-{color}`
 * Both `label` and `message` are shields.io-encoded via {@link shieldsEncode}.
 *
 * @param label - Left-side badge label (e.g. "Updated")
 * @param value - Right-side badge value (raw, will be encoded internally)
 * @param color - Badge hex color without `#` (e.g. "58a6ff")
 * @returns Markdown image string for the badge
 *
 * @example
 * makeBadge("Updated", "Mar 27 2026, 9:10 PM", "58a6ff")
 * // → "![Updated](https://img.shields.io/badge/Updated-Mar_27_2026%2C_9%3A10_PM-58a6ff?style=flat-square)"
 */
function makeBadge(label: string, value: string, color: string): string {
    const encodedLabel = shieldsEncode(label);
    const encodedValue = shieldsEncode(value);
    return `![${label}](https://img.shields.io/badge/${encodedLabel}-${encodedValue}-${color}?style=flat-square)`;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Generates a formatted timestamp or shields.io badge for the current time.
 *
 * ## Modes
 * | Mode       | Example Output                    |
 * |------------|-----------------------------------|
 * | `format`   | `Mar 27 2026, 9:10 PM`            |
 * | `relative` | `a few seconds ago`               |
 * | `unix`     | `1774645827`                      |
 * | `iso`      | `2026-03-27T21:10:27.510Z`        |
 *
 * ## Badge Encoding
 * Shields.io path segments require double-escaping:
 * dashes become `--`, underscores become `__`, spaces become `_`,
 * and all remaining special characters are `encodeURIComponent`-encoded.
 * This ensures colons in times, dots in ISO strings, and commas in
 * formatted dates all survive the URL round-trip correctly.
 *
 * @param widget - Widget instance containing {@link TimestampConfig}
 * @returns Formatted timestamp string, or Markdown badge image string
 *
 * @example
 * // badge mode (default)
 * timestamp(widget)
 * // → "![Updated](https://img.shields.io/badge/Updated-Mar_27_2026%2C_9%3A10_PM-58a6ff?style=flat-square)"
 *
 * @example
 * // raw mode (badge: false)
 * timestamp(widget)
 * // → "Mar 27 2026, 9:10 PM"
 */
export function timestamp(widget: Widget<TimestampConfig>): string {
    core.startGroup('Timestamp Widget');
    try {
        const config = resolveConfig(widget.config);
        const now = getMoment(config.tz);

        core.info(`Mode: ${config.mode} | TZ: ${config.tz ?? 'UTC'} | Badge: ${config.badge}`);

        const value = computeValue(now, config.mode, config.format);
        core.info(`Computed value: ${value}`);

        return config.badge ? makeBadge(config.label, value, config.color) : value;
    } finally {
        core.endGroup();
    }
}
