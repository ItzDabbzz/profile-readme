/**
 * Represents a parsed widget instance extracted from source content.
 *
 * @typeParam T - Configuration shape for the widget
 */
export interface Widget<T> {
    /** Parsed configuration object (may be partial or empty if parsing fails). */
    config: Partial<T>;

    /** The full matched string from the source (including comment syntax). */
    matched: string;
}

/**
 * Extracts widget declarations from a source string.
 *
 * Widgets are defined using HTML comment syntax:
 * ```
 * <!-- widgetName:{ "key": "value" } -->
 * ```
 *
 * Examples:
 * ```
 * <!-- stats -->
 * <!-- stats:{"rows":5,"showStars":true} -->
 * ```
 *
 * @typeParam T - Expected configuration shape
 *
 * @param name - Widget name to match (e.g., "stats")
 * @param source - Input string (e.g., README or markdown file)
 *
 * @returns Array of parsed widgets or `undefined` if none found
 *
 * @remarks
 * - Config must be valid JSON (not JS object literal)
 * - Invalid JSON is silently ignored (falls back to `{}`)
 * - Multiple widgets of the same name are supported
 * - Matching is global and order-preserving
 *
 * @example
 * ```ts
 * const widgets = widgets<{ rows: number }>(
 *   "stats",
 *   "<!-- stats:{\"rows\":5} -->"
 * );
 *
 * console.log(widgets?.[0].config.rows); // 5
 * ```
 */
export function widgets<T>(name: string, source: string): Widget<T>[] | undefined {
    const comment = `<!--\\s*${name}(?::({.*}))?\\s*-->`;
    const regex = new RegExp(comment, 'g');
    const widgets: Widget<T>[] = [];

    let res: RegExpExecArray | null;
    while ((res = regex.exec(source)) !== null) {
        const widget: Widget<T> = {
            matched: res[0],
            config: {}
        };

        try {
            if (res[1]) widget.config = JSON.parse(res[1]) as T;
        } catch (error) {
            // Silently ignore invalid JSON configs
        }

        widgets.push(widget);
    }

    if (widgets.length === 0) return undefined;
    return widgets;
}
