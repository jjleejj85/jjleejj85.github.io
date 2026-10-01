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

function moveCableSectionBeforeDownstream() {
  const cableSection = document.querySelector("#cable-sysid");
  const resultsBlocks = Array.from(
    document.querySelectorAll(".experiments-section .results-block")
  );
  const downstreamBlock = resultsBlocks.find((block) =>
    block.querySelector(".results-kicker")?.textContent.trim() === "Downstream Control"
  );

  if (cableSection && downstreamBlock) {
    downstreamBlock.before(cableSection);
  }
}

function reorderCableResultBlocks() {
  const section = document.querySelector("#cable-sysid");
  if (!section) {
    return;
  }

  const blocks = Array.from(section.children).filter((child) =>
    child.classList.contains("artifact-block")
  );
  const byHeading = new Map(
    blocks.map((block) => [
      block.querySelector(".artifact-head h4")?.textContent.trim(),
      block
    ])
  );
  const ordered = [
    "Real-robot execution on two cables",
    "Terminal keypoint-to-target distance",
    "Simulation system identification"
  ].map((heading) => byHeading.get(heading));

  if (ordered.every(Boolean)) {
    section.querySelector(".results-copy")?.after(...ordered);
  }
}

function reorderDownstreamArtifacts() {
  const resultsBlocks = Array.from(
    document.querySelectorAll(".experiments-section .results-block")
  );
  const downstream = resultsBlocks.find((block) =>
    block.querySelector(".results-kicker")?.textContent.trim() === "Downstream Control"
  );
  if (!downstream) {
    return;
  }

  const artifacts = Array.from(downstream.children).filter((child) =>
    child.classList.contains("artifact-block")
  );
  const headingOf = (block) =>
    block.querySelector(".artifact-head h4")?.textContent.replace(/\s+/g, " ").trim();
  const rollout = artifacts.find((block) => headingOf(block)?.startsWith("Rollout comparison"));
  const curves = artifacts.find((block) => headingOf(block)?.startsWith("Training curves"));

  if (rollout && curves) {
    curves.before(rollout);
  }
}

function positionQualitativeRolloutsBeforeBenchmarkTitle() {
  const resultsBlocks = Array.from(
    document.querySelectorAll(".experiments-section .results-block")
  );
  const headingOf = (block) =>
    block.querySelector(".results-copy h3")?.textContent.replace(/\s+/g, " ").trim();
  const rollouts = resultsBlocks.find((block) =>
    headingOf(block)?.startsWith("Rollouts across pushing")
  );
  const benchmark = resultsBlocks.find((block) =>
    headingOf(block) === "Performance on benchmark manipulation tasks"
  );
  const benchmarkKicker = benchmark?.querySelector(".results-kicker");

  if (rollouts && benchmarkKicker) {
    rollouts.classList.add("inline-rollouts");
    benchmark.before(benchmarkKicker, rollouts);
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
      if (panel.hasAttribute("data-native-loop")) {
        for (const video of panel.querySelectorAll("video")) {
          if (isActive) {
            video.play().catch(() => {});
          } else {
            video.pause();
            safelySetCurrentTime(video, 0);
          }
        }
      } else {
        createGroupController(panel).stop(true);
      }
    }

    const activePanel = panels.find((panel) => panel.id === targetId);
    if (!activePanel || activePanel.hasAttribute("data-native-loop")) {
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

function initializeShowreel() {
  const showreel = document.querySelector(".showreel");
  const viewport = showreel?.querySelector(".showreel-viewport");
  const track = showreel?.querySelector(".showreel-track");
  const group = showreel?.querySelector(".showreel-group");
  if (!showreel || !viewport || !track || !group) {
    return;
  }

  const clone = group.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("video").forEach((video) => video.setAttribute("tabindex", "-1"));
  track.append(clone);

  const videos = Array.from(showreel.querySelectorAll("video"));
  const getScrollAnimation = () =>
    track.getAnimations().find((animation) => animation.animationName === "showreel-scroll");

  const moveBy = (distance) => {
    const animation = getScrollAnimation();
    const duration = animation?.effect?.getTiming().duration;
    const groupWidth = group.getBoundingClientRect().width;
    if (!animation || typeof duration !== "number" || !groupWidth) {
      return;
    }

    const currentTime = Number(animation.currentTime) || 0;
    const nextTime = currentTime + (distance * duration) / groupWidth;
    animation.currentTime = ((nextTime % duration) + duration) % duration;
  };

  viewport.addEventListener("wheel", (event) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) {
      return;
    }

    event.preventDefault();
    moveBy(delta);
  }, { passive: false });
  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    moveBy(event.key === "ArrowRight" ? 220 : -220);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      videos.forEach((video) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.05 });
    observer.observe(showreel);
  }
}

positionQualitativeRolloutsBeforeBenchmarkTitle();
moveCableSectionBeforeDownstream();
reorderCableResultBlocks();
reorderDownstreamArtifacts();
initializeTaskTabs();
initializeStandaloneVideoGroups();
initializeOutboundLinks();
initializeShowreel();
