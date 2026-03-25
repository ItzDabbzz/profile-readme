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
async function run() {
    const token = core.getInput('github_token'); // GitHub token for API calls
    const wakaTimeKey = core.getInput('wakatime_key');
    const template = core.getInput('template'); // Path to template file
    const readme = core.getInput('readme'); // Output README path
    const username = core.getInput('username'); // GitHub username
    const subscriptions = core.getInput('feed'); // RSS feed JSON file path
    const octokit = github.getOctokit(token);

    let source = fs.readFileSync(template, 'utf-8');

    // Process GitHub activity widgets
    const activityWidgets = widgets<ActivityConfig>('GITHUB_ACTIVITY', source);
    if (activityWidgets) {
        core.info(`Found ${activityWidgets.length} activity widget.`);
        core.info(`Collecting activity for user ${username}...`);
        const events = await octokit.rest.activity.listPublicEventsForUser({
            username,
            per_page: 100
        });
        for (const widget of activityWidgets) {
            core.info(`Generating widget "${widget.matched}"`);
            source = source.replace(widget.matched, activity(events, widget));
        }
    }

    // Process GitHub repository widgets
    const reposWidgets = widgets<ReposConfig>('GITHUB_REPOS', source);
    if (reposWidgets) {
        core.info(`Found ${reposWidgets.length} repos widget.`);
        core.info(`Collecting repos for user ${username}...`);
        const repositories = await octokit.rest.repos.listForUser({
            username,
            type: 'all',
            per_page: 100
        });
        for (const widget of reposWidgets) {
            core.info(`Generating widget "${widget.matched}"`);
            source = source.replace(widget.matched, repos(repositories, widget));
        }
    }

    // Process timestamp widgets
    const timestampWidgets = widgets<TimestampConfig>('TIMESTAMP', source);
    if (timestampWidgets) {
        core.info(`Found ${timestampWidgets.length} timestamp widget.`);
        for (const widget of timestampWidgets) {
            core.info(`Generating widget "${widget.matched}"`);
            source = source.replace(widget.matched, timestamp(widget));
        }
    }

    // Process WakaTime widgets
    const wakatimeWidgets = widgets<WakaTimeConfig>('WAKATIME', source);
    if (wakatimeWidgets) {
        for (const widget of wakatimeWidgets) {
            if (!widget.config.apiKey && wakaTimeKey) (widget.config as any).apiKey = wakaTimeKey;
            source = source.replace(widget.matched, await wakatime(widget));
        }
    }

    // Process RSS feed widgets
    if (fs.existsSync(subscriptions)) {
        const subscribe = JSON.parse(fs.readFileSync(subscriptions, 'utf-8'));
        const feedWidgets = widgets<FeedConfig>('FEED', source);
        if (feedWidgets) {
            core.info(`Found ${feedWidgets.length} feed widget.`);
            for (const widget of feedWidgets) {
                source = source.replace(widget.matched, await feed(subscribe, widget));
            }
        }
    }

    // Write final output to README
    fs.writeFileSync(readme, source);
}

// Execute the runner and handle errors
run().catch(error => {
    core.error(error);
    process.exit(1);
});
