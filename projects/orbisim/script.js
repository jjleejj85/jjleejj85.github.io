const groupControllers = new WeakMap();

function initializeOutboundLinks() {
  const links = Array.from(document.querySelectorAll('a[href]'));

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) {
      continue;
    }

    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer");
  }
}

function ensureMetadata(video) {
  if (video.readyState >= 1 && Number.isFinite(video.duration)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("error", finish);
      resolve();
    };

    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("canplay", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    video.load();
  });
}

function safelySetCurrentTime(video, value) {
  try {
    video.currentTime = value;
  } catch (_error) {
    // Ignore transient seeks before metadata is ready.
  }
}

function createGroupController(group) {
  if (groupControllers.has(group)) {
    return groupControllers.get(group);
  }

  const videos = Array.from(group.querySelectorAll("video"));
  let prepared = false;
  let preparePromise = null;
  let rafId = null;
  let startTime = 0;
  let groupDuration = 0;
  let timeline = [];

  const holdFirstFrame = (item) => {
    item.video.pause();
    const firstFrameTime = item.duration > 0.002 ? 0.001 : 0;
    safelySetCurrentTime(item.video, firstFrameTime);
  };

  const prepare = async () => {
    if (prepared || !videos.length) {
      return;
    }

    if (!preparePromise) {
      preparePromise = (async () => {
        await Promise.all(videos.map((video) => ensureMetadata(video)));

        timeline = videos.map((video) => {
          video.loop = false;
          video.muted = true;
          video.playsInline = true;
          return {
            video,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
          };
        });

        groupDuration = Math.max(...timeline.map((item) => item.duration), 0);

        timeline = timeline.map((item) => ({
          ...item,
          startOffset: Math.max(0, groupDuration - item.duration),
        }));

        for (const item of timeline) {
          holdFirstFrame(item);
        }

        prepared = true;
      })();
    }

    await preparePromise;
  };

  const syncAt = (groupTime) => {
    if (!prepared || !groupDuration) {
      return;
    }

    for (const item of timeline) {
      const { video, duration, startOffset } = item;
      if (!duration) {
        continue;
      }

      if (groupTime < startOffset) {
        holdFirstFrame(item);
        continue;
      }

      const targetTime = Math.min(duration - 0.001, Math.max(0, groupTime - startOffset));
      if (Math.abs(video.currentTime - targetTime) > 0.06) {
        safelySetCurrentTime(video, targetTime);
      }
      video.playbackRate = 1;
      video.play().catch(() => {});
    }
  };

  const stop = (reset = false) => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    for (const item of timeline) {
      item.video.pause();
      if (reset) {
        holdFirstFrame(item);
      }
    }
  };

  const tick = (now) => {
    if (!prepared || !groupDuration) {
      return;
    }

    const elapsed = (now - startTime) / 1000;
    const groupTime = elapsed % groupDuration;
    syncAt(groupTime);
    rafId = requestAnimationFrame(tick);
  };

  const start = async () => {
    await prepare();
    stop(true);
    startTime = performance.now();
    syncAt(0);
    rafId = requestAnimationFrame(tick);
  };

  const controller = { prepare, start, stop };
  groupControllers.set(group, controller);
  return controller;
}

function initializeTaskTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-task-target]"));
  const panels = Array.from(document.querySelectorAll("[data-video-group]"));
  let activationToken = 0;

  const activatePanel = async (targetId) => {
    activationToken += 1;
    const token = activationToken;

    for (const tab of tabs) {
      const isActive = tab.dataset.taskTarget === targetId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    }

    for (const panel of panels) {
      const isActive = panel.id === targetId;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
      const controller = createGroupController(panel);
      controller.stop(true);
    }

    const activePanel = panels.find((panel) => panel.id === targetId);
    if (!activePanel) {
      return;
    }

    const controller = createGroupController(activePanel);
    await controller.start();

    if (token !== activationToken) {
      controller.stop(true);
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      activatePanel(tab.dataset.taskTarget);
    });
  }

  if (tabs.length) {
    activatePanel(tabs[0].dataset.taskTarget);
  }
}

function initializeStandaloneVideoGroups() {
  const groups = Array.from(document.querySelectorAll("[data-sync-video-group]"));

  for (const group of groups) {
    const controller = createGroupController(group);
    controller.start();
  }
}

initializeTaskTabs();
initializeStandaloneVideoGroups();
initializeOutboundLinks();
