import moment from "moment-timezone";
import { Widget } from "../widget";

/**
 * Configuration options for the timestamp widget.
 */
export interface TimestampConfig {
  /** Custom date format (used when mode = "format"). */
  format?: string;

  /**
   * Timezone identifier (e.g., "America/New_York").
   * If not provided or invalid, UTC is used.
   */
  tz?: string;

  /** Output mode for the timestamp. */
  mode?: "format" | "relative" | "unix" | "iso";

  /** Whether to render the output as a shields.io badge. */
  badge?: boolean;

  /** Label displayed on the badge (if enabled). */
  label?: string;

  /** Badge color (hex without #, e.g., "58a6ff"). */
  color?: string;
}

/**
 * Fully resolved configuration with defaults applied.
 */
type ResolvedConfig = {
  format: string;
  tz: string | null;
  mode: "format" | "relative" | "unix" | "iso";
  badge: boolean;
  label: string;
  color: string;
};

/** Default date format used when none is provided. */
const DEFAULT_FORMAT = "MMM D YYYY, h:mm A";

/**
 * Applies default values to the provided configuration.
 *
 * @param input - Partial timestamp configuration
 * @returns Fully resolved configuration object
 */
function resolveConfig(input: TimestampConfig): ResolvedConfig {
  return {
    format: input.format ?? DEFAULT_FORMAT,
    tz: input.tz ?? null,
    mode: input.mode ?? "format",
    badge: input.badge ?? true,
    label: input.label ?? "Updated",
    color: input.color ?? "58a6ff",
  };
}

/**
 * Returns a moment instance for the current time in the given timezone.
 *
 * - If `tz` is null → returns UTC time
 * - If `tz` is valid → returns time in that timezone
 * - If `tz` is invalid → falls back to UTC
 *
 * @param tz - IANA timezone string (e.g., "America/New_York")
 * @returns Moment instance representing "now"
 */
function getMoment(tz: string | null): moment.Moment {
  if (!tz) return moment.utc();
  if (moment.tz.zone(tz)) return moment().tz(tz);
  return moment.utc();
}

/**
 * Generates a shields.io badge markdown string.
 *
 * @param label - Badge label
 * @param value - Badge value
 * @param color - Badge color (hex without #)
 * @returns Markdown image string for the badge
 */
function makeBadge(label: string, value: string, color: string) {
  return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)`;
}

/**
 * Sanitizes a value for safe inclusion in a badge URL.
 *
 * Replaces characters that may break shields.io rendering:
 * - ":" → "-"
 * - "." → removed
 * - "T" → space
 * - "Z" → " UTC"
 *
 * @param value - Raw value string
 * @returns Sanitized value
 */
function safeBadgeValue(value: string): string {
  return value
    .replace(/:/g, "-")
    .replace(/\./g, "")
    .replace(/T/g, " ")
    .replace(/Z/g, " UTC");
}

/**
 * Generates a formatted timestamp or badge based on widget configuration.
 *
 * Supported modes:
 * - `"format"`   → Custom formatted date (default)
 * - `"relative"` → Relative time (e.g., "2 hours ago")
 * - `"unix"`     → Unix timestamp (seconds)
 * - `"iso"`      → ISO 8601 string
 *
 * If `badge` is enabled, output is rendered as a shields.io badge.
 *
 * @param widget - Widget instance containing timestamp configuration
 * @returns Formatted timestamp string or badge markdown
 *
 * @example
 * ```ts
 * const output = timestamp(widget);
 * // => ![Updated-2 hours ago-blue]
 * ```
 */
export function timestamp(widget: Widget<TimestampConfig>): string {
  const config = resolveConfig(widget.config);
  const now = getMoment(config.tz);

  let value: string;

  switch (config.mode) {
    case "relative":
      value = now.fromNow();
      break;
    case "unix":
      value = String(now.unix());
      break;
    case "iso":
      value = now.toISOString();
      break;
    default:
      value = now.format(config.format);
  }

  if (config.badge) {
    return makeBadge(
      config.label,
      encodeURIComponent(safeBadgeValue(value)),
      config.color
    );
  }

  return value;
}