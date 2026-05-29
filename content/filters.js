function injectDimStyles() {
  if (document.getElementById('yt-hider-dim-styles')) return;
  const style = document.createElement('style');
  style.id = 'yt-hider-dim-styles';
  style.textContent = `
    [data-yt-hider-badge-target] {
      position: relative !important;
    }
    .yt-hider-badge {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      background: rgba(0, 0, 0, 0.72);
      border-radius: inherit;
      pointer-events: none;
      z-index: 10;
    }
    .yt-hider-badge-logo {
      width: 36px;
      height: 36px;
      object-fit: contain;
      display: block;
    }
    .yt-hider-badge-reason {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.85);
      font-family: 'Roboto', Arial, sans-serif;
      letter-spacing: 0.2px;
      text-align: center;
      padding: 0 6px;
      line-height: 1.2;
    }
  `;
  document.head.appendChild(style);
}

let excludedChannelCacheRaw = null;
let excludedChannelCacheSet = new Set();
const excludedChannelMatchCache = new WeakMap();
let currentChannelCachePath = null;
let currentChannelCacheCandidates = [];

function createDimBadge(reason) {
  const badge = document.createElement('div');
  badge.className = 'yt-hider-badge';
  let logoUrl = '';
  try {
    logoUrl = chrome.runtime.getURL('assets/icons/youtube-hider-logo.png');
  } catch (_) {}
  badge.innerHTML = `${logoUrl ? `<img class="yt-hider-badge-logo" src="${logoUrl}" />` : ''}${reason ? `<span class="yt-hider-badge-reason">${reason}</span>` : ''}`;
  return badge;
}

function applyFilter(element, reason) {
  if (!element) return;
  if (prefs.dimMode) {
    if (element.dataset.ytHiderDimmed) return;
    element.dataset.ytHiderDimmed = '1';
    const target =
      element.querySelector('ytd-thumbnail') ||
      element.querySelector('yt-thumbnail-view-model') ||
      element.querySelector('ytm-thumbnail-cover-view-model') ||
      element;
    target.dataset.ytHiderBadgeTarget = '1';
    target.appendChild(createDimBadge(reason));
  } else {
    if (element.dataset.ytHiderHidden) return;
    element.dataset.ytHiderHidden = '1';
    element.style.display = 'none';
  }
}

function resetAppliedFilters() {
  document.querySelectorAll('[data-yt-hider-hidden]').forEach(el => {
    el.style.display = '';
    delete el.dataset.ytHiderHidden;
  });
  document.querySelectorAll('[data-yt-hider-dimmed]').forEach(el => {
    delete el.dataset.ytHiderDimmed;
  });
  document.querySelectorAll('.yt-hider-badge').forEach(el => el.remove());
  document.querySelectorAll('[data-yt-hider-badge-target]').forEach(el => {
    delete el.dataset.ytHiderBadgeTarget;
  });
}

function forceHide(element) {
  if (!element) return;
  if (element.dataset.ytHiderHidden) return;
  element.dataset.ytHiderHidden = '1';
  element.style.display = 'none';
}

function hideWatched(pathname) {
  const { hideThreshold } = prefs;

  // Slider at 0 = Off, don't hide anything
  if (hideThreshold === 0) return;

  document
    .querySelectorAll(
      'ytd-thumbnail-overlay-resume-playback-renderer #progress, .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, ytm-thumbnail-overlay-resume-playback-renderer .thumbnail-overlay-resume-playback-progress',
    )
    .forEach(bar => {
      if (bar.classList.contains('ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment')) {
        const thumbnail = bar.closest('ytd-thumbnail');
        if (thumbnail && thumbnail.querySelector('ytd-thumbnail-overlay-now-playing-renderer[now-playing-badge]')) return;
      }

      const pct = parseFloat(bar.style.width) || 0;
      if (pct <= hideThreshold) return;

      let item = bar;

      const isChannelPage = pathname && pathname.startsWith('/@');

      const selectors =
        pathname === '/watch'
          ? 'ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model, ytm-video-with-context-renderer, ytm-compact-video-renderer'
          : isChannelPage
            ? 'ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer'
            : 'ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-rich-item-renderer';

      while (item && !item.matches(selectors)) {
        item = item.parentElement;
      }
      if (!item) return;

      applyFilter(item, 'Already watched');
    });
}

// ── Upload Date Filter: hiding logic ──

function shouldHideDateFilter(pathname) {
  const {
    dateFilterNewerThreshold,
    dateFilterOlderThreshold,
    dateFilterHomeEnabled,
    dateFilterChannelEnabled,
    dateFilterSearchEnabled,
    dateFilterSubsEnabled,
    dateFilterCorrEnabled,
  } = prefs;

  // Both sliders at Off (threshold 0) means feature is disabled
  if (dateFilterNewerThreshold === 0 && dateFilterOlderThreshold === 0)
    return false;

  return (
    (pathname === '/' && dateFilterHomeEnabled) ||
    (pathname && pathname.startsWith('/@') && dateFilterChannelEnabled) ||
    (pathname === '/results' && dateFilterSearchEnabled) ||
    (pathname === '/watch' && dateFilterCorrEnabled) ||
    (pathname === '/feed/subscriptions' && dateFilterSubsEnabled)
  );
}

function getDateFilterReason(ageDays) {
  const { dateFilterNewerThreshold, dateFilterOlderThreshold } = prefs;

  if (dateFilterNewerThreshold > 0 && ageDays < dateFilterNewerThreshold)
    return 'Video too new';
  if (dateFilterOlderThreshold > 0 && ageDays > dateFilterOlderThreshold)
    return 'Video too old';

  return null;
}

function getMetadataSpansFromContainer(metadataContainer) {
  const rowSelectors =
    '.yt-content-metadata-view-model-wiz__metadata-row, .yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow';
  const textSelectors =
    'span.yt-core-attributed-string, span.ytContentMetadataViewModelMetadataText';

  const metadataRows = metadataContainer.querySelectorAll(rowSelectors);
  if (metadataRows.length) {
    const spans = [];
    metadataRows.forEach(row => {
      row.querySelectorAll(textSelectors).forEach(span => {
        spans.push(span);
      });
    });
    return spans;
  }

  return Array.from(
    metadataContainer.querySelectorAll('span.ytContentMetadataViewModelMetadataText'),
  );
}

function hideDateFilter() {
  if (isCurrentPageExcludedChannel()) return;

  const selectors = getVideoContainerSelectors();

  // Classic format: #metadata-line
  document.querySelectorAll('#metadata-line').forEach(metaLine => {
    let spans = metaLine.querySelectorAll('span.inline-metadata-item');
    if (!spans.length) {
      spans = metaLine.querySelectorAll('span');
    }
    if (!spans.length) return;

    const result = resolveUploadAgeFromSpans(spans);
    if (!result) return;
    const dateReason = getDateFilterReason(result.ageDays);
    if (!dateReason) return;
    if (isChannelExcludedForFilterTarget(result.span, selectors)) return;

    findAndHideContainer(result.span, selectors, dateReason);
  });

  // Mobile format
  document
    .querySelectorAll('.YtmBadgeAndBylineRendererItemByline')
    .forEach(span => {
      const text = (span.textContent || '').trim();
      // Mobile format concatenates: "1.2M views · 2 days ago"
      const parts = text.split(/[·•]/);
      let ageDays = NaN;
      for (const part of parts) {
        ageDays = extractUploadAgeDays(part.trim());
        if (!isNaN(ageDays)) break;
      }
      if (isNaN(ageDays)) return;
      const dateReason = getDateFilterReason(ageDays);
      if (!dateReason) return;

      const container = span.closest(
        'ytm-video-with-context-renderer, ytm-rich-item-renderer, ytm-compact-video-renderer',
      );
      if (container) {
        if (isExcludedChannelContainer(container)) return;
        applyFilter(container, dateReason);
        const wrapper = container.closest('ytm-rich-item-renderer');
        if (wrapper) applyFilter(wrapper, dateReason);
      }
    });

  // New format: yt-content-metadata-view-model
  document
    .querySelectorAll('yt-content-metadata-view-model, yt-lockup-view-model')
    .forEach(metadataContainer => {
      const allSpans = getMetadataSpansFromContainer(metadataContainer);
      if (!allSpans.length) return;

      const result = resolveUploadAgeFromSpans(allSpans);
      if (!result) return;
      const dateReason = getDateFilterReason(result.ageDays);
      if (!dateReason) return;
      if (isChannelExcludedForFilterTarget(result.span, selectors)) return;

      findAndHideContainer(result.span, selectors, dateReason);
    });
}

function hideUnderVisuals() {
  if (isCurrentPageExcludedChannel()) return;

  const selectors = getVideoContainerSelectors();

  document.querySelectorAll('#metadata-line').forEach(metaLine => {
    let spans = metaLine.querySelectorAll('span.inline-metadata-item');
    if (!spans.length) {
      spans = metaLine.querySelectorAll('span');
    }
    if (!spans.length) return;

    const result = resolveViewsFromSpans(spans);
    if (!result) return;
    const viewReason = getViewFilterReason(result.views);
    if (!viewReason) return;
    if (isChannelExcludedForFilterTarget(result.span, selectors)) return;

    findAndHideContainer(result.span, selectors, viewReason);
  });

  document
    .querySelectorAll('.YtmBadgeAndBylineRendererItemByline')
    .forEach(span => {
      const text = (span.textContent || '').trim();
      const result = extractViewCount(text);
      if (!result || typeof result !== 'object') return;
      const viewReason = getViewFilterReason(result.views);
      if (!viewReason) return;

      const container = span.closest(
        'ytm-video-with-context-renderer, ytm-rich-item-renderer, ytm-compact-video-renderer',
      );

      if (container) {
        if (isExcludedChannelContainer(container)) return;
        applyFilter(container, viewReason);
        const wrapper = container.closest('ytm-rich-item-renderer');
        if (wrapper) applyFilter(wrapper, viewReason);
      }
    });

  hideNewFormatVideos();
}

function hideNewFormatVideos() {
  const selectors = getVideoContainerSelectors();

  document
    .querySelectorAll('yt-content-metadata-view-model, yt-lockup-view-model')
    .forEach(metadataContainer => {
      const allSpans = getMetadataSpansFromContainer(metadataContainer);
      if (!allSpans.length) return;

      const result = resolveViewsFromSpans(allSpans);

      if (!result) return;
      const viewReason = getViewFilterReason(result.views);
      if (!viewReason) return;
      if (isChannelExcludedForFilterTarget(result.span, selectors)) return;

      findAndHideContainer(result.span, selectors, viewReason);
    });
}

function normalizeChannelExclusionValue(value) {
  return String(value || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/^https?:\/\/(www\.)?(m\.)?youtube\.com\//i, '')
    .replace(/^\/+/, '')
    .replace(/^channel\//i, '')
    .replace(/^c\//i, '')
    .replace(/^user\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\/+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compactChannelExclusionValue(value) {
  return normalizeChannelExclusionValue(value).replace(/[^a-z0-9]/g, '');
}

function getExcludedChannelSet() {
  const raw = String(prefs.channelExclusionList || '');
  if (raw === excludedChannelCacheRaw) return excludedChannelCacheSet;

  const excluded = new Set();

  raw
    .split(/[\n,]+/)
    .map(normalizeChannelExclusionValue)
    .filter(Boolean)
    .forEach(value => {
      excluded.add(value);
      const compact = compactChannelExclusionValue(value);
      if (compact) excluded.add(compact);
    });

  excludedChannelCacheRaw = raw;
  excludedChannelCacheSet = excluded;
  return excludedChannelCacheSet;
}

function getCurrentChannelCandidates() {
  const pathname = window.location.pathname || '';
  if (pathname === currentChannelCachePath) return currentChannelCacheCandidates;

  currentChannelCachePath = pathname;
  currentChannelCacheCandidates = [];

  if (!pathname.startsWith('/@')) return currentChannelCacheCandidates;

  const normalized = normalizeChannelExclusionValue(pathname);
  if (!normalized) return currentChannelCacheCandidates;

  currentChannelCacheCandidates.push(normalized);
  const compact = compactChannelExclusionValue(normalized);
  if (compact && compact !== normalized) currentChannelCacheCandidates.push(compact);

  return currentChannelCacheCandidates;
}

function isCurrentChannelExcluded(excluded) {
  return getCurrentChannelCandidates().some(candidate => excluded.has(candidate));
}

function isCurrentPageExcludedChannel() {
  const excluded = getExcludedChannelSet();
  return excluded.size > 0 && isCurrentChannelExcluded(excluded);
}

function collectChannelCandidates(container) {
  if (!container) return [];

  const candidates = [];
  const seen = new Set();
  const add = value => {
    const normalized = normalizeChannelExclusionValue(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
    const compact = compactChannelExclusionValue(normalized);
    if (compact && compact !== normalized && !seen.has(compact)) {
      seen.add(compact);
      candidates.push(compact);
    }
  };
  const addFromAriaLabel = value => {
    const label = String(value || '').trim();
    if (!label) return;
    add(label);

    const byMatch = label.match(/\sby\s(.+?)(?:\s(?:\d|streamed|premiered|views?|watching|ago)\b|$)/i);
    if (byMatch) add(byMatch[1]);

    const channelMatch = label.match(/(?:go to|visit|open)\s+channel\s+(.+)$/i);
    if (channelMatch) add(channelMatch[1]);
  };

  const roots = getChannelCandidateSearchRoots(container);

  roots.forEach(root => {
    root
      .querySelectorAll(
        [
          'ytd-channel-name a',
          '#channel-name a',
          '#byline a',
          '#owner-text a',
          'a[href*="/@"]',
          'a[href*="/channel/"]',
          'a[href*="/c/"]',
          'a[href*="/user/"]',
          'yt-formatted-string.ytd-channel-name',
          '.yt-content-metadata-view-model-wiz__metadata-row a',
          '.yt-content-metadata-view-model__metadata-row a',
          'yt-lockup-metadata-view-model a[href*="/@"]',
          'yt-lockup-metadata-view-model a[href*="/channel/"]',
        ].join(', '),
      )
      .forEach(el => {
        add(el.textContent);
        add(el.getAttribute('title'));
        addFromAriaLabel(el.getAttribute('aria-label'));
        add(el.getAttribute('href'));
      });

    root.querySelectorAll('[aria-label*="channel" i]').forEach(el => {
      const label = el.getAttribute('aria-label') || '';
      addFromAriaLabel(label);
      add(label.replace(/^go to channel\s+/i, ''));
    });

    root
      .querySelectorAll(
        [
          'a#video-title',
          '#video-title-link',
          'h3 a[href*="/watch"]',
          'a[href*="/watch"]',
        ].join(', '),
      )
      .forEach(el => {
        addFromAriaLabel(el.getAttribute('aria-label'));
      });
  });

  return candidates;
}

function getChannelCandidateSearchRoots(container) {
  const roots = [];
  const addRoot = root => {
    if (root && root.nodeType === 1 && !roots.includes(root)) roots.push(root);
  };

  addRoot(container);
  [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'yt-lockup-view-model',
    'yt-lockup-metadata-view-model',
    'ytm-rich-item-renderer',
    'ytm-video-with-context-renderer',
    'ytm-compact-video-renderer',
  ].forEach(selector => addRoot(container.closest(selector)));

  return roots;
}

function isExcludedChannelContainer(container) {
  if (!container) return false;

  const excluded = getExcludedChannelSet();
  if (!excluded.size) return false;

  const cacheKey = `${excludedChannelCacheRaw || ''}\n${window.location.pathname || ''}`;
  const cached = excludedChannelMatchCache.get(container);
  if (cached && cached.key === cacheKey) return cached.value;

  let value = isCurrentChannelExcluded(excluded);
  if (!value) {
    value = collectChannelCandidates(container).some(candidate =>
      excluded.has(candidate),
    );
  }

  excludedChannelMatchCache.set(container, { key: cacheKey, value });
  return value;
}

function isChannelExcludedForFilterTarget(element, selectors) {
  const container = getMatchingVideoContainer(element, selectors);
  if (!container) return false;
  return isExcludedChannelContainer(container);
}

function getViewFilterReason(views) {
  const { viewsHideThreshold, viewsHideMaxThreshold } = prefs;

  if (
    viewsHideThreshold > 0 &&
    viewsHideMaxThreshold > 0 &&
    viewsHideThreshold >= viewsHideMaxThreshold
  ) {
    return null;
  }

  if (viewsHideThreshold > 0 && views < viewsHideThreshold) {
    return 'Views too low';
  }
  if (viewsHideMaxThreshold > 0 && views > viewsHideMaxThreshold) {
    return 'Views too high';
  }

  return null;
}

function hideShorts() {
  document.querySelectorAll('ytm-rich-section-renderer').forEach(section => {
    if (section.querySelector('ytm-shorts-lockup-view-model')) {
      forceHide(section);
    }
  });

  document.querySelectorAll('ytm-pivot-bar-item-renderer').forEach(item => {
    if (item.querySelector('.pivot-shorts')) {
      forceHide(item);
    }
  });

  document
    .querySelectorAll(
      'ytd-guide-section-renderer, tp-yt-paper-item, ytd-video-renderer, ytd-reel-shelf-renderer, ytm-reel-shelf-renderer',
    )
    .forEach(node => {
      if (node.querySelector('ytm-shorts-lockup-view-model')) {
        forceHide(node);
      }
      if (
        node.querySelector('badge-shape[aria-label="Shorts"]') ||
        node.querySelector(
          'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',
        )
      ) {
        forceHide(node);
      }
    });

  document.querySelectorAll('a[href^="/shorts/"]').forEach(link => {
    const shelf = link.closest(
      'ytd-rich-shelf-renderer, ytm-reel-shelf-renderer',
    );
    if (shelf) {
      forceHide(shelf);
      return;
    }
    const item = link.closest(
      'ytd-rich-item-renderer, ytm-video-with-context-renderer',
    );
    if (item) forceHide(item);
  });

  document.querySelectorAll('a[title="Shorts"]').forEach(link => {
    const entry =
      link.closest('ytd-guide-entry-renderer') ||
      link.closest('ytd-mini-guide-entry-renderer') ||
      link.closest('ytm-pivot-bar-item-renderer');
    if (entry) forceHide(entry);
  });

  document.querySelectorAll('a[title="Shorts"]').forEach(link => {
    const entry = link.closest('ytd-guide-entry-renderer');
    if (entry) forceHide(entry);
  });

  document
    .querySelectorAll('yt-formatted-string[title="Shorts"]')
    .forEach(link => {
      const entry = link.closest('yt-chip-cloud-chip-renderer');
      if (entry) forceHide(entry);
    });

  document.querySelectorAll('ytm-chip-cloud-chip-renderer').forEach(chip => {
    if (chip.textContent.trim() === 'Shorts') {
      forceHide(chip);
    }
  });

  document
    .querySelectorAll('yt-tab-shape[tab-title="Shorts"]')
    .forEach(link => {
      forceHide(link);
    });

  document.querySelectorAll('grid-shelf-view-model').forEach(node => {
    if (
      node.querySelector(
        'ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model',
      )
    ) {
      forceHide(node);
    }
  });

  document
    .querySelectorAll(
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2), grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
    )
    .forEach(node => {
      forceHide(node);
    });

  document.querySelectorAll('yt-chip-cloud-chip-renderer').forEach(node => {
    const label = node.querySelector('.ytChipShapeChip');
    if (label && label.textContent.trim() === 'Shorts') {
      forceHide(node);
    }
  });

  document.querySelectorAll('ytd-rich-section-renderer').forEach(section => {
    if (
      section.querySelector(
        '[data-yt-hider-hidden], [data-yt-hider-dimmed]',
      )
    ) {
      forceHide(section);
    }
  });

  document
    .querySelectorAll('ytd-mini-guide-entry-renderer a[href^="/shorts"]')
    .forEach(link => {
      const entry = link.closest('ytd-mini-guide-entry-renderer');
      if (entry) forceHide(entry);
    });

  document
    .querySelectorAll('a[aria-label="Shorts"][href^="/shorts"]')
    .forEach(link => {
      const mini = link.closest('ytd-mini-guide-entry-renderer');
      const guide = link.closest('ytd-guide-entry-renderer');
      const pivot = link.closest('ytm-pivot-bar-item-renderer');
      if (mini) forceHide(mini);
      if (guide) forceHide(guide);
      if (pivot) forceHide(pivot);
    });
}

function shouldHideWatched(pathname) {
  const {
    hideHomeEnabled,
    hideChannelEnabled,
    hideSearchEnabled,
    hideSubsEnabled,
    hideCorrEnabled,
  } = prefs;

  return (
    (pathname === '/' && hideHomeEnabled) ||
    (pathname && pathname.startsWith('/@') && hideChannelEnabled) ||
    (pathname === '/results' && hideSearchEnabled) ||
    (pathname === '/watch' && hideCorrEnabled) ||
    (pathname === '/feed/subscriptions' && hideSubsEnabled)
  );
}

function shouldHideViews(pathname) {
  const {
    viewsHideThreshold,
    viewsHideMaxThreshold,
    viewsHideHomeEnabled,
    viewsHideChannelEnabled,
    viewsHideSearchEnabled,
    viewsHideSubsEnabled,
    viewsHideCorrEnabled,
  } = prefs;

  if (viewsHideThreshold === 0 && viewsHideMaxThreshold === 0) return false;
  if (
    viewsHideThreshold > 0 &&
    viewsHideMaxThreshold > 0 &&
    viewsHideThreshold >= viewsHideMaxThreshold
  ) {
    return false;
  }

  return (
    (pathname === '/' && viewsHideHomeEnabled) ||
    (pathname && pathname.startsWith('/@') && viewsHideChannelEnabled) ||
    (pathname === '/results' && viewsHideSearchEnabled) ||
    (pathname === '/watch' && viewsHideCorrEnabled) ||
    (pathname === '/feed/subscriptions' && viewsHideSubsEnabled)
  );
}

function shouldHideShorts(pathname) {
  const { hideShortsEnabled, hideShortsSearchEnabled } = prefs;

  return (
    hideShortsEnabled &&
    pathname !== '/feed/history' &&
    (hideShortsSearchEnabled || pathname !== '/results')
  );
}

function isCoreFilterPath(pathname) {
  if (!pathname) return false;

  if (
    pathname === '/feed/playlists' ||
    pathname === '/playlist' ||
    pathname === '/feed/library' ||
    pathname === '/feed/history'
  ) {
    return false;
  }

  return (
    pathname === '/' ||
    pathname === '/results' ||
    pathname === '/watch' ||
    pathname === '/feed/subscriptions' ||
    pathname.startsWith('/@')
  );
}

function hideMixes() {
  document.querySelectorAll('[class*="content-id-RD"]').forEach(el => {
    const item =
      el.closest('ytd-rich-item-renderer, ytm-rich-item-renderer') ||
      el.closest('yt-lockup-view-model');
    if (item) applyFilter(item, 'Mix playlist');
  });

  document.querySelectorAll('a[href*="start_radio=1"]').forEach(link => {
    const item =
      link.closest(
        'ytd-rich-item-renderer, ytd-compact-radio-renderer, ytd-radio-renderer, ytm-rich-item-renderer, ytm-video-with-context-renderer',
      ) || link.closest('yt-lockup-view-model');
    if (item) applyFilter(item, 'Mix playlist');
  });

  document
    .querySelectorAll('ytd-radio-renderer, ytd-compact-radio-renderer')
    .forEach(node => {
      applyFilter(node, 'Mix playlist');
    });
}

function shouldHideMixes(pathname) {
  return prefs.hideMixesEnabled && isCoreFilterPath(pathname);
}

function hidePlaylists() {
  document.querySelectorAll('[class*="content-id-PL"]').forEach(el => {
    const item =
      el.closest('ytd-rich-item-renderer, ytm-rich-item-renderer') ||
      el.closest('yt-lockup-view-model');
    if (item) applyFilter(item, 'Playlist');
  });

  document
    .querySelectorAll('ytd-playlist-renderer, ytd-compact-playlist-renderer')
    .forEach(node => {
      applyFilter(node, 'Playlist');
    });
}

function shouldHidePlaylists(pathname) {
  return prefs.hidePlaylistsEnabled && isCoreFilterPath(pathname);
}

function hideLives() {
  document.querySelectorAll('badge-shape.yt-badge-shape--thumbnail-live, badge-shape.yt-badge-shape--live, badge-shape.ytBadgeShapeThumbnailLive, badge-shape.ytBadgeShapeLive').forEach(el => {
    const item =
      el.closest('ytd-rich-item-renderer, ytm-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer') ||
      el.closest('yt-lockup-view-model');
    if (item) applyFilter(item, 'Live stream');
  });

  document.querySelectorAll('yt-lockup-view-model').forEach(el => {
    if (
      el.querySelector('.yt-spec-avatar-shape--live-ring') ||
      el.querySelector('.yt-spec-avatar-shape__live-badge')
    ) {
      const item = el.closest('ytd-rich-item-renderer, ytm-rich-item-renderer') || el;
      applyFilter(item, 'Live stream');
    }
  });
}

function shouldHideLives(pathname) {
  return prefs.hideLivesEnabled && isCoreFilterPath(pathname);
}
