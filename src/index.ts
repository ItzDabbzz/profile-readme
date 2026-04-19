import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import { widgets } from './widget';
import { ActivityConfig, activity } from './widgets/activity';
import { FeedConfig, feed } from './widgets/feed';
import { ReposConfig, repos } from './widgets/repos';
import { TimestampConfig, timestamp } from './widgets/timestamp';
import { WakaTimeConfig, wakatime } from './widgets/wakatime';

/**
 * Returns singular/plural text for log messages.
 *
 * @param count - Number of items
 * @param noun - Singular noun to pluralize when needed
 * @returns Human-readable count label
 */
function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Builds a stable progress label for widget rendering logs.
 *
 * @param widgetType - Widget family being rendered
 * @param index - Zero-based widget index
 * @param total - Total widget count for the family
 * @returns Log-safe widget progress label
 */
function renderLabel(widgetType: string, index: number, total: number): string {
    return `${widgetType} widget ${index + 1}/${total}`;
}

/**
 * Converts unknown thrown values into a safe action failure string.
 *
 * @param error - Unknown thrown value
 * @returns Error message suitable for GitHub Actions output
 */
function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

/**
 * Main workflow runner for updating markdown templates with widgets.
 *
 * This script reads a template file, searches for widget placeholders,
 * fetches relevant data (GitHub events, repos, WakaTime stats, RSS feeds),
 * and replaces widget placeholders with generated content. Finally, it writes
 * the output to the target README file.
 *
 * @remarks
 * Widgets are identified in the template using HTML comment syntax:
 * ```
 * <!-- WIDGET_NAME:{ "configKey": "value" } -->
 * ```
 * Supported widgets:
 * - `GITHUB_ACTIVITY` → GitHub activity events
 * - `GITHUB_REPOS` → GitHub repositories
 * - `TIMESTAMP` → Current time badge or formatted timestamp
 * - `WAKATIME` → WakaTime coding stats
 * - `FEED` → RSS feed content
 *
 * Configuration can be partially provided in the template comment or via GitHub Action inputs.
 */
export async function run(): Promise<void> {
    const token = core.getInput('github_token'); // GitHub token for API calls
    const wakaTimeKey = core.getInput('wakatime_key');
    const template = core.getInput('template'); // Path to template file
    const readme = core.getInput('readme'); // Output README path
    const username = core.getInput('username'); // GitHub username
    const subscriptions = core.getInput('feed'); // RSS feed JSON file path

    core.setSecret(token);
    if (wakaTimeKey) core.setSecret(wakaTimeKey);

    const octokit = github.getOctokit(token);

    let source = fs.readFileSync(template, 'utf-8');

    // Process GitHub activity widgets
    const activityWidgets = widgets<ActivityConfig>('GITHUB_ACTIVITY', source);
    if (activityWidgets) {
        core.info(`Found ${pluralize(activityWidgets.length, 'activity widget')}.`);
        core.info(`Collecting activity for user ${username}...`);
        const events = await octokit.rest.activity.listPublicEventsForUser({
            username,
            per_page: 100
        });
        for (const [index, widget] of activityWidgets.entries()) {
            core.info(`Rendering ${renderLabel('activity', index, activityWidgets.length)}.`);
            source = source.replace(widget.matched, activity(events, widget));
        }
    }

    // Process GitHub repository widgets
    const reposWidgets = widgets<ReposConfig>('GITHUB_REPOS', source);
    if (reposWidgets) {
        core.info(`Found ${pluralize(reposWidgets.length, 'repository widget')}.`);
        core.info(`Collecting repos for user ${username}...`);
        const repositories = await octokit.rest.repos.listForUser({
            username,
            type: 'all',
            per_page: 100
        });
        for (const [index, widget] of reposWidgets.entries()) {
            core.info(`Rendering ${renderLabel('repository', index, reposWidgets.length)}.`);
            source = source.replace(widget.matched, repos(repositories, widget));
        }
    }

    // Process timestamp widgets
    const timestampWidgets = widgets<TimestampConfig>('TIMESTAMP', source);
    if (timestampWidgets) {
        core.info(`Found ${pluralize(timestampWidgets.length, 'timestamp widget')}.`);
        for (const [index, widget] of timestampWidgets.entries()) {
            core.info(`Rendering ${renderLabel('timestamp', index, timestampWidgets.length)}.`);
            source = source.replace(widget.matched, timestamp(widget));
        }
    }

    // Process WakaTime widgets
    const wakatimeWidgets = widgets<WakaTimeConfig>('WAKATIME', source);
    if (wakatimeWidgets) {
        core.info(`Found ${pluralize(wakatimeWidgets.length, 'WakaTime widget')}.`);
        for (const [index, widget] of wakatimeWidgets.entries()) {
            core.info(`Rendering ${renderLabel('WakaTime', index, wakatimeWidgets.length)}.`);
            if (!widget.config.apiKey && wakaTimeKey) (widget.config as any).apiKey = wakaTimeKey;
            source = source.replace(widget.matched, await wakatime(widget));
        }
    }

    // Process RSS feed widgets
    const feedWidgets = widgets<FeedConfig>('FEED', source);
    if (feedWidgets) {
        core.info(`Found ${pluralize(feedWidgets.length, 'feed widget')}.`);

        if (!subscriptions || !fs.existsSync(subscriptions)) {
            core.warning('Feed widgets found, but no readable feed file was provided. Skipping feed widgets.');
        } else {
            const subscribe = JSON.parse(fs.readFileSync(subscriptions, 'utf-8'));
            for (const [index, widget] of feedWidgets.entries()) {
                core.info(`Rendering ${renderLabel('feed', index, feedWidgets.length)}.`);
                source = source.replace(widget.matched, await feed(subscribe, widget));
            }
        }
    }

    // Write final output to README
    fs.writeFileSync(readme, source);
}

if (process.env.NODE_ENV !== 'test') {
    run().catch(error => {
        core.setFailed(formatError(error));
    });
}
