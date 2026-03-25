# 🧪 Widget System Test Template

> This README is used to validate all widget outputs and configurations.

---

# ⏱ WakaTime — Core Variants

## Default (table)
<!--WAKATIME:{"rows":5,"style":"table","showProjects":true}-->

## Compact
<!--WAKATIME:{"style":"compact","rows":6}-->

## List
<!--WAKATIME:{"style":"list","rows":5}-->

## Monthly Range
<!--WAKATIME:{"range":"last_30_days","rows":7}-->

---

# ⏱ WakaTime — Feature Toggles

## Languages Only
<!--WAKATIME:{"showEditors":false,"showOS":false,"showProjects":false,"rows":8}-->

## No Badges
<!--WAKATIME:{"style":"compact","showBadges":false}-->

## Highlights + Summary
<!--WAKATIME:{"showHighlights":true,"showSummary":true}-->

---

# 📰 Feed — Core

## Default
<!--FEED:{"rows":5}-->

## Raw
<!--FEED:{"raw":true,"rows":5}-->

## No Domain
<!--FEED:{"showDomain":false,"rows":5}-->

---

# 📰 Feed — Behavior

## Shuffle
<!--FEED:{"shuffle":true,"rows":5}-->

## Select Sources
<!--FEED:{"select":["YouTube"],"rows":5}-->

---

# 🗂 GitHub Activity — Core

## Default
<!--GITHUB_ACTIVITY:{"rows":5,"style":"table"}-->

## Raw
<!--GITHUB_ACTIVITY:{"rows":5,"raw":true}-->

## Compact
<!--GITHUB_ACTIVITY:{"rows":5,"compact":true}-->

---

# 🗂 GitHub Activity — Filters

## With Dates
<!--GITHUB_ACTIVITY:{"rows":5,"showDate":true}-->

## Relative Dates
<!--GITHUB_ACTIVITY:{"rows":5,"showDate":true,"dateFormat":"relative"}-->

## Include PR Events Only
<!--GITHUB_ACTIVITY:{"rows":5,"include":["PullRequestEvent","PullRequestReviewEvent"]}-->

## Exclude Noise
<!--GITHUB_ACTIVITY:{"rows":5,"exclude":["PushEvent","WatchEvent"]}-->

---

# 📦 Repositories — Core

## Default
<!--GITHUB_REPOS:{"rows":5}-->

## Raw
<!--GITHUB_REPOS:{"rows":5,"raw":true}-->

## With Language
<!--GITHUB_REPOS:{"rows":5,"showLanguage":true}-->

---

# 📦 Repositories — Sorting

## By Stars
<!--GITHUB_REPOS:{"rows":5,"sort":"stars"}-->

## By Recent Push
<!--GITHUB_REPOS:{"rows":5,"sort":"pushed"}-->

## Alphabetical
<!--GITHUB_REPOS:{"rows":5,"sort":"full_name","order":"asc"}-->

---

# 📦 Repositories — Filters

## Min Stars
<!--GITHUB_REPOS:{"rows":5,"minStars":10}-->

## Topic Filter
<!--GITHUB_REPOS:{"rows":5,"topic":"typescript"}-->

## Include Forks
<!--GITHUB_REPOS:{"rows":5,"showForks_repos":true}-->

---

# 🕐 Timestamp — Core

## Default
<!--TIMESTAMP-->

## Custom Format
<!--TIMESTAMP:{"format":"YYYY-MM-DD HH:mm:ss"}-->

## Timezone
<!--TIMESTAMP:{"tz":"America/Chicago"}-->

---

# 🕐 Timestamp — Modes

## Relative
<!--TIMESTAMP:{"mode":"relative"}-->

## Unix
<!--TIMESTAMP:{"mode":"unix"}-->

## ISO
<!--TIMESTAMP:{"mode":"iso"}-->

---

# 🕐 Timestamp — Badge Variants

## Custom Label
<!--TIMESTAMP:{"label":"Updated","tz":"America/Chicago"}-->

## Custom Color
<!--TIMESTAMP:{"label":"Build","color":"ff0000"}-->

## No Badge (raw output)
<!--TIMESTAMP:{"badge":false,"format":"MMM D YYYY"}-->

---

# 🧪 Combined Test

<!--WAKATIME:{"rows":3}-->
<!--FEED:{"rows":3}-->
<!--GITHUB_ACTIVITY:{"rows":3,"compact":true}-->
<!--GITHUB_REPOS:{"rows":3}-->
<!--TIMESTAMP:{"mode":"relative","label":"Updated"}-->

---

# ✅ End of Test