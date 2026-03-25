# 🧩 profile-readme

> A GitHub Action for dynamically updating your profile README with widgets — activity feeds, repos, WakaTime stats, RSS feeds, and timestamps.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Action](https://img.shields.io/badge/GitHub-Action-2088FF?style=flat-square&logo=github-actions)](https://github.com/ItzDabbzz/profile-readme)

---

## 📋 Table of Contents

- [Usage](#usage)
- [Widgets](#widgets)
  - [GitHub Activity](#-github-activity)
  - [GitHub Repos](#-github-repos)
  - [Timestamp](#-timestamp)
  - [WakaTime](#-wakatime)
  - [RSS Feed](#-rss-feed)
- [Action Inputs](#-action-inputs)
- [Helper Utilities](#-helper-utilities)
- [License](#-license)

---

## Usage

### Workflow Setup

Add the following workflow to `.github/workflows/update-readme.yml`:

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
        with:
          persist-credentials: false
          fetch-depth: 0

      - name: Create README.md
        uses: ItzDabbzz/profile-readme@master
        with:
          username: <your_username>
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit & Push changes
        uses: actions-js/push@master
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Template Syntax

Widgets are placed in your `TEMPLATE.md` as HTML comments using the following syntax:

```
<!--WIDGET_NAME:{"optionKey": "value"}-->
```

The JSON config is always optional. A minimal example:

```markdown
## 👋 Hi, I'm ItzDabbzz

### 🗣 Recent Activity

<!--GITHUB_ACTIVITY:{"rows": 5}-->

---

### 📦 My Repositories

<!--GITHUB_REPOS:{"rows": 4, "sort": "stars"}-->

---

<p align="center">
  Last updated: <!--TIMESTAMP-->
</p>
```

---

## Widgets

### ⚡ GitHub Activity

Displays your most recent public GitHub events.

```markdown
<!--GITHUB_ACTIVITY:{"rows": 5}-->
```

**Example output (compact/raw):**

```
⬆️ Pushed 3 commits to ItzDabbzz/profile-readme
🔀 Opened PR #12 in ItzDabbzz/some-project
❗ Opened issue #8 in ItzDabbzz/other-repo
⭐ Starred another-user/cool-repo
🍴 Forked someone/awesome-tool
```

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | `number` | `10` | Maximum number of events to display |
| `raw` | `boolean` | `false` | Strip markdown formatting (forces compact mode) |
| `include` | `string[]` | all supported | Event types to include |
| `exclude` | `string[]` | `[]` | Event types to exclude |
| `showDate` | `boolean` | `false` | Show event timestamps |
| `dateFormat` | `string` | `"relative"` | Date format (moment.js string or `"relative"`) |
| `showLinks` | `boolean` | `true` | Render clickable links to GitHub resources |
| `groupByRepo` | `boolean` | `false` | Group events under repository headers |
| `style` | `"table" \| "list" \| "compact"` | `"table"` | Output style |

#### Supported Event Types

| Event | Badge | Emoji |
|-------|-------|-------|
| `PushEvent` | push | ⬆️ |
| `PullRequestEvent` | PR | 🔀 |
| `PullRequestReviewEvent` | review | 👀 |
| `PullRequestReviewCommentEvent` | review | 💬 |
| `IssuesEvent` | issue | ❗ |
| `IssueCommentEvent` | comment | 🗣 |
| `ForkEvent` | fork | 🍴 |
| `ReleaseEvent` | release | 🚀 |
| `WatchEvent` | star | ⭐ |
| `CreateEvent` | create | 🌿 |
| `DeleteEvent` | delete | 🗑 |
| `PublicEvent` | public | 🎉 |
| `MemberEvent` | member | 👥 |
| `SponsorshipEvent` | sponsor | 💖 |

---

### 📦 GitHub Repos

Displays a list of your GitHub repositories with sorting and filtering.

```markdown
<!--GITHUB_REPOS:{"rows": 5, "sort": "stars"}-->
```

**Example output (compact/raw):**

```
📦 ItzDabbzz/profile-readme ⭐ 120 🍴 14 [TypeScript]
📦 ItzDabbzz/another-project ⭐ 88 [JavaScript]
```

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | `number` | `5` | Maximum number of repositories to display |
| `sort` | `string` | `"stars"` | Sort by: `"stars"`, `"forks"`, `"created"`, `"updated"`, `"pushed"`, `"full_name"`, `"size"` |
| `order` | `"asc" \| "desc"` | `"desc"` | Sort direction |
| `raw` | `boolean` | `false` | Strip markdown formatting (forces compact mode) |
| `style` | `"table" \| "list" \| "compact"` | `"table"` | Output style |
| `showDescription` | `boolean` | `true` | Show repository description |
| `showLanguage` | `boolean` | `false` | Show primary programming language |
| `showForks` | `boolean` | `false` | Show fork count |
| `showStars` | `boolean` | `true` | Show star count |
| `showArchived` | `boolean` | `false` | Include archived repositories |
| `showForks_repos` | `boolean` | `false` | Include forked repositories |
| `showBadges` | `boolean` | `true` | Use shields.io badges instead of plain text |
| `minStars` | `number` | — | Minimum star count required to include a repo |
| `topic` | `string` | — | Filter repositories by topic |
| `exclude` | `string[]` | `[]` | Repository full names to exclude (e.g. `"ItzDabbzz/old-repo"`) |

---

### 🕐 Timestamp

Renders the current date/time as a formatted string or a shields.io badge.

```markdown
<!--TIMESTAMP-->
<!--TIMESTAMP:{"mode": "relative", "tz": "America/New_York"}-->
<!--TIMESTAMP:{"format": "dddd, MMMM Do YYYY, h:mm A", "badge": false}-->
```

**Example output:**

```
![Updated](https://img.shields.io/badge/Updated-Mar%2025%202026%2C%2012-00%20PM-58a6ff?style=flat-square)
```

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `string` | `"MMM D YYYY, h:mm A"` | [moment.js format string](https://momentjs.com/docs/#/displaying/) (used when `mode` is `"format"`) |
| `tz` | `string` | UTC | IANA timezone (e.g. `"America/Chicago"`, `"Europe/London"`) |
| `mode` | `"format" \| "relative" \| "unix" \| "iso"` | `"format"` | Output mode |
| `badge` | `boolean` | `true` | Render as a shields.io badge |
| `label` | `string` | `"Updated"` | Badge label text |
| `color` | `string` | `"58a6ff"` | Badge color (hex, no `#`) |

#### Modes

| Mode | Example Output |
|------|---------------|
| `format` | `Mar 25 2026, 12:00 PM` |
| `relative` | `2 hours ago` |
| `unix` | `1742896800` |
| `iso` | `2026-03-25T12:00:00.000Z` |

---

### ⏱ WakaTime

Fetches and displays your WakaTime coding stats including languages, editors, OS, and projects.

```markdown
<!--WAKATIME:{"range": "last_7_days", "showLanguages": true, "style": "table"}-->
```

**Example output:**

```
## ⏱ WakaTime Stats
> Last 7 Days · 24h 30m · 🌍 America/Chicago

### 💬 Languages
| Name       | Time    | Usage                          |
|------------|---------|--------------------------------|
| TypeScript | 12h 10m | ████████████░░░░░░░░  62.3%    |
| Python     | 5h 20m  | ████████░░░░░░░░░░░░  27.1%    |
```

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `INPUT_WAKATIME_KEY` env | WakaTime API key |
| `range` | `"last_7_days" \| "last_30_days" \| "last_6_months" \| "last_year"` | `"last_7_days"` | Stats time range |
| `showLanguages` | `boolean` | `true` | Show languages section |
| `showEditors` | `boolean` | `true` | Show editors section |
| `showOS` | `boolean` | `true` | Show operating systems section |
| `showProjects` | `boolean` | `false` | Show projects section |
| `rows` | `number` | `5` | Max items per section |
| `showBadges` | `boolean` | `true` | Use shields.io badges for labels |
| `showTime` | `boolean` | `true` | Show formatted time (e.g. `2h 30m`) |
| `showPercent` | `boolean` | `true` | Show percentage values |
| `style` | `"table" \| "list" \| "compact"` | `"table"` | Output style |
| `showSummary` | `boolean` | `true` | Show summary badges at the top |
| `showHighlights` | `boolean` | `true` | Show highlight insights (e.g. top language) |

#### WakaTime API Key Setup

Add your WakaTime API key as a repository secret named `WAKATIME_KEY`, then pass it in your workflow:

```yaml
- name: Create README.md
  uses: ItzDabbzz/profile-readme@master
  with:
    username: ItzDabbzz
    github_token: ${{ secrets.GITHUB_TOKEN }}
    wakatime_key: ${{ secrets.WAKATIME_KEY }}
```

---

### 📰 RSS Feed

Fetches and renders items from an RSS or Atom feed defined in a `FEEDS.json` file.

```markdown
<!--FEED:{"rows": 5, "select": "hackernews show", "title": true}-->

<!--FEED:{"rows": 5, "select": ["hackernews ask", "hackernews show"], "raw": true}-->
```

**Example output (table style):**

### 📰 Hackernews Show

> Generated from feed [here](https://hnrss.org/show). Add it to your RSS reader!

---

| Index | Posts | Domain |
|-------|-------|--------|
| 1 | [Show HN: Example Project](https://example.com) | [example.com](https://example.com) |
| 2 | [Show HN: Another Cool Thing](https://another.io) | [another.io](https://another.io) |

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | `number` | `5` | Number of feed items to display |
| `raw` | `boolean` | `false` | Render as a numbered list instead of a table |
| `select` | `string \| string[]` | all feeds | Feed name(s) from `FEEDS.json` to use |
| `shuffle` | `boolean` | `false` | Randomize item order |
| `title` | `boolean` | `false` | Render a section header from the feed name |

#### FEEDS.json

Create a `FEEDS.json` file in your repository root mapping feed names to URLs:

```json
{
  "hackernews top":  "https://hnrss.org/frontpage",
  "hackernews show": "https://hnrss.org/show",
  "hackernews ask":  "https://hnrss.org/ask"
}
```

Pass the path via the `feed` input if it differs from the default:

```yaml
- name: Create README.md
  uses: ItzDabbzz/profile-readme@master
  with:
    username: ItzDabbzz
    github_token: ${{ secrets.GITHUB_TOKEN }}
    feed: ./FEEDS.json
```

---

## 📥 Action Inputs

| Name | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `github_token` | `string` | — | ✅ | GitHub token for API access. Use `${{ secrets.GITHUB_TOKEN }}` |
| `username` | `string` | — | ✅ | Your GitHub username |
| `template` | `string` | `./TEMPLATE.md` | ❌ | Path to the input template file |
| `readme` | `string` | `./README.md` | ❌ | Path to write the generated output |
| `feed` | `string` | `./FEEDS.json` | ❌ | Path to your RSS feeds JSON file |
| `wakatime_key` | `string` | — | ❌ | WakaTime API key (required if using `WAKATIME` widget) |

---

## 🛠 Helper Utilities

The following utilities are available internally and used across widgets.

### `capitalize(str)`

Converts a string to title case, handling underscores and extra whitespace.

```ts
capitalize("hello_world")     // "Hello World"
capitalize("multiple   spaces") // "Multiple Spaces"
capitalize("pushEvent")       // "PushEvent"
```

### `pickRandomItems(items, limit)`

Picks `limit` unique random items from an array. Throws if `limit < 1` or exceeds the array length.

```ts
pickRandomItems([1, 2, 3, 4], 2) // e.g. [3, 1]
pickRandomItems(["a", "b", "c"], 1) // e.g. ["b"]
```

---

## 📄 License

Released under the [MIT License](LICENSE).