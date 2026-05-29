# YouTube Hider

A customized Manifest V3 browser extension for filtering YouTube videos locally in Chrome or Microsoft Edge.

This fork is based on Matteo Lucerni's YouTube Hider extension and adds more granular upload-date filtering, min/max view filtering, channel exclusions, and offline-only packaging changes.

## Features

### Watched Videos

Hide videos you have already watched from Home, Channel pages, Subscriptions, Search results, and Related videos. The watched threshold is configurable from 0-100%.

### Upload Date Filter

Hide videos by age with two independent controls:

- **Hide newer than**: hide videos newer than the selected age.
- **Hide older than**: hide videos older than the selected age.

The date sliders support short ranges plus yearly steps up to 20 years. The popup warns when the newer/older settings conflict in a way that would hide everything.

### Min And Max Views Filter

Filter videos by view count with both lower and upper limits:

- **Minimum views** hides videos below the selected count.
- **Maximum views** hides videos above the selected count.

The view sliders include fine-grained lower values, 100K increments through the hundred-thousands, and every million from 1M through 10M. The popup warns when the minimum is greater than or equal to the maximum.

### Channel Exclusions

Add channel names, handles, or YouTube channel URLs to the channel exclusion list. Videos from excluded channels skip the upload-date and view-count filters.

Examples:

```text
theaisearch
@theaisearch
https://www.youtube.com/@theaisearch
```

Channel exclusions are intended only for date and view limits. Other filters, such as watched videos, Shorts, Mixes, Playlists, and Lives, can still apply.

### Content Type Filters

Optionally hide:

- Shorts
- Mixes
- Playlists
- Live streams

### Hide Or Dim Mode

Filtered videos can either be fully hidden or dimmed with an overlay that explains why the video was filtered.

### Floating Quick Settings

A draggable floating button on YouTube pages gives quick access to the main filter controls without opening the extension popup. It is hidden on video watch pages.

### Offline-Focused Build

The active extension code avoids external service links and extension-initiated network calls. The only host permissions are for YouTube pages, where the content script runs.

## Install In Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder, or extract a build zip and select the extracted folder.
5. Pin the extension if you want quick access to the popup.

## Install In Microsoft Edge

1. Open `edge://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder, or extract a build zip and select the extracted folder.
5. Open YouTube and configure the extension from the toolbar popup.

## Build

Package the extension:

```powershell
.\build.ps1
```

The build script writes a zip file to `dist/`. Files in `dist/` are ignored by git.

## Project Structure

```text
youtube-hider-extension
|-- assets/
|   `-- icons/
|-- background.js          Service worker, badge updates, lifecycle
|-- build.ps1              Packaging script
|-- content/
|   |-- env.js             DEV_MODE flag
|   |-- fab/               Floating button and mini-panel
|   |-- filters.js         Filtering logic
|   |-- init.js            Page detection, MutationObserver, bootstrap
|   |-- parsers.js         View count and upload date parsing
|   |-- state.js           Preferences and storage listener
|   |-- tutorial.js        Floating button tutorial
|   |-- utils.js           Shared utilities
|   `-- warning.js         High-filtering warning
|-- manifest.json          Manifest V3 extension definition
|-- popup/
|   |-- popup.html         Popup UI
|   |-- popup.js           Popup behavior and storage
|   |-- data.js            Slider steps and labels
|   `-- *.css              Popup styles
`-- README.md
```

## How It Works

1. Content scripts load on YouTube pages listed in `manifest.json`.
2. User settings are stored in `chrome.storage.sync`.
3. The content script scans YouTube video metadata in the current page.
4. Matching videos are hidden or dimmed according to the active filters.
5. A MutationObserver reruns filtering as YouTube dynamically loads more content.
6. Channel exclusions are cached so excluded channel pages and repeated cards do less work.

## Current Custom Changes

- Removed active extension links to external web pages.
- Forced production/offline mode with `DEV_MODE = false`.
- Added upload-date steps up to 20 years.
- Added maximum view filtering.
- Added more granular 100K and million-step view thresholds.
- Added conflict warnings for impossible view/date filter combinations.
- Added channel exclusions for date and view filters.
- Optimized channel exclusion matching to reduce slow DOM scans.

## License

This project keeps the original MIT License.
