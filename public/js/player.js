/**
 * Trion Academy - Protected Anti-Skip YouTube Player
 * Features:
 * - YouTube Unlisted video integration
 * - Forward seeking/skipping completely blocked
 * - Only "-5 sec" rewind allowed
 * - Anti-hack loop monitoring playback time
 * - Progress tracking & completion detection
 * - Top & Bottom shields preventing clickout to YouTube
 */

(function () {
  const container = document.getElementById('playerContainer');
  if (!container) return;

  const videoId = container.dataset.videoId;
  const lessonId = container.dataset.lessonId;
  const courseId = container.dataset.courseId;
  let initialWatchedSeconds = parseFloat(container.dataset.watchedSeconds) || 0;

  if (!videoId) {
    console.warn('[Player] No videoId provided for this lesson.');
    return;
  }

  let ytPlayer = null;
  let maxWatchedTime = initialWatchedSeconds;
  let monitorInterval = null;
  let saveInterval = null;
  let isVideoPlaying = false;
  let videoDuration = 0;
  let isCompleted = false;

  // DOM Elements
  const btnPlayPause = document.getElementById('btnPlayPause');
  const iconPlayPause = document.getElementById('iconPlayPause');
  const textPlayPause = document.getElementById('textPlayPause');
  const btnRewind5 = document.getElementById('btnRewind5');
  const btnMute = document.getElementById('btnMute');
  const iconVolume = document.getElementById('iconVolume');
  const volumeSlider = document.getElementById('volumeSlider');
  const speedSelect = document.getElementById('speedSelect');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const watchedProgressBar = document.getElementById('watchedProgressBar');
  const timeDisplay = document.getElementById('timeDisplay');
  const clickOverlay = document.getElementById('clickOverlay');
  const bigPlayBtn = document.getElementById('bigPlayBtn');
  const playerToast = document.getElementById('playerToast');
  const completionBadge = document.getElementById('completionBadge');

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Toast warning
  let toastTimer = null;
  function showWarningToast(message) {
    if (!playerToast) return;
    if (message) {
      const span = playerToast.querySelector('span');
      if (span) span.textContent = message;
    }
    playerToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      playerToast.classList.remove('show');
    }, 2800);
  }

  // YouTube API callback
  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('ytPlayerWrapper', {
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,          // Hides native controls & seekbar
        disablekb: 1,         // Disables native YouTube keyboard shortcuts
        modestbranding: 1,    // Minimizes YouTube branding
        rel: 0,               // Do not show related videos
        fs: 0,                // Disable native fullscreen button (custom handled)
        iv_load_policy: 3,    // Hide annotations
        playsinline: 1,
        origin: window.location.origin
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  };

  // Dynamically load YouTube IFrame API script
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  } else if (window.YT && window.YT.Player) {
    window.onYouTubeIframeAPIReady();
  }

  function onPlayerReady(event) {
    videoDuration = ytPlayer.getDuration() || 0;
    updateTimeDisplay(0, videoDuration);

    // If user already had progress, resume up to that point
    if (initialWatchedSeconds > 0) {
      ytPlayer.seekTo(initialWatchedSeconds, true);
      maxWatchedTime = initialWatchedSeconds;
      updateProgressBar(initialWatchedSeconds, videoDuration);
    }

    // Start background sync every 5 seconds
    saveInterval = setInterval(syncProgress, 5000);
  }

  function onPlayerStateChange(event) {
    // YT.PlayerState: PLAYING (1), PAUSED (2), ENDED (0), BUFFERING (3)
    if (event.data === YT.PlayerState.PLAYING) {
      isVideoPlaying = true;
      updatePlayButtonUI(true);
      startAntiSkipMonitor();
    } else {
      isVideoPlaying = false;
      updatePlayButtonUI(false);
      stopAntiSkipMonitor();
      if (event.data === YT.PlayerState.ENDED) {
        handleVideoEnded();
      }
    }
  }

  function updatePlayButtonUI(playing) {
    if (iconPlayPause) {
      iconPlayPause.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
    if (textPlayPause) {
      textPlayPause.textContent = playing ? 'Пауза' : 'Старт';
    }
    if (bigPlayBtn) {
      if (playing) {
        bigPlayBtn.classList.add('playing');
      } else {
        bigPlayBtn.classList.remove('playing');
      }
    }
  }

  function togglePlayPause() {
    if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
    if (isVideoPlaying) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  }

  // Rewind exactly 5 seconds
  function rewind5Seconds() {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
    const current = ytPlayer.getCurrentTime();
    const target = Math.max(0, current - 5);
    ytPlayer.seekTo(target, true);

    // Visual button bounce
    if (btnRewind5) {
      btnRewind5.classList.add('scale-90');
      setTimeout(() => btnRewind5.classList.remove('scale-90'), 150);
    }
  }

  // Anti-skip enforcement loop (runs every 200ms)
  function startAntiSkipMonitor() {
    stopAntiSkipMonitor();
    monitorInterval = setInterval(() => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;

      const current = ytPlayer.getCurrentTime();
      videoDuration = ytPlayer.getDuration() || videoDuration;

      // 🛡️ ANTI-SKIP DETECTION:
      // If student managed to jump ahead further than max legitimate watched time (+1.5s safety buffer)
      if (current > maxWatchedTime + 1.5) {
        ytPlayer.seekTo(maxWatchedTime, true);
        showWarningToast('Перемотка вперед заблокирована! Смотрите последовательно.');
      } else if (current > maxWatchedTime) {
        maxWatchedTime = current;
      }

      updateProgressBar(current, videoDuration);
      updateTimeDisplay(current, videoDuration);

      // Check for completion (> 85% watched)
      if (videoDuration > 0 && (maxWatchedTime / videoDuration) >= 0.85 && !isCompleted) {
        isCompleted = true;
        markLessonCompleted();
      }
    }, 200);
  }

  function stopAntiSkipMonitor() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  }

  function updateProgressBar(current, duration) {
    if (!duration || duration <= 0) return;
    const percent = Math.min(100, Math.max(0, (current / duration) * 100));
    if (watchedProgressBar) {
      watchedProgressBar.style.width = `${percent}%`;
    }
  }

  function updateTimeDisplay(current, duration) {
    if (timeDisplay) {
      timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }
  }

  function handleVideoEnded() {
    isCompleted = true;
    syncProgress(true);
    markLessonCompleted();
  }

  function markLessonCompleted() {
    if (completionBadge) {
      completionBadge.innerHTML = '<i class="fa-solid fa-circle-check text-green-500 mr-1.5"></i> Урок пройден';
      completionBadge.className = 'inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-green-950 text-green-400 border border-green-800';
    }
  }

  // Periodic API progress sync
  async function syncProgress(completed = false) {
    if (!lessonId || !courseId) return;
    try {
      await fetch(`/api/progress/${lessonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId,
          watchedSeconds: Math.floor(maxWatchedTime),
          completed: completed || isCompleted
        })
      });
    } catch (err) {
      console.warn('Failed to sync progress:', err);
    }
  }

  // Event Listeners
  if (clickOverlay) {
    clickOverlay.addEventListener('click', togglePlayPause);
  }
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', togglePlayPause);
  }
  if (btnRewind5) {
    btnRewind5.addEventListener('click', rewind5Seconds);
  }

  // Volume & Mute
  if (btnMute && volumeSlider) {
    btnMute.addEventListener('click', () => {
      if (!ytPlayer) return;
      if (ytPlayer.isMuted()) {
        ytPlayer.unMute();
        volumeSlider.value = ytPlayer.getVolume() || 80;
        iconVolume.className = 'fa-solid fa-volume-high';
      } else {
        ytPlayer.mute();
        volumeSlider.value = 0;
        iconVolume.className = 'fa-solid fa-volume-xmark';
      }
    });

    volumeSlider.addEventListener('input', (e) => {
      if (!ytPlayer) return;
      const val = Number(e.target.value);
      if (val === 0) {
        ytPlayer.mute();
        iconVolume.className = 'fa-solid fa-volume-xmark';
      } else {
        ytPlayer.unMute();
        ytPlayer.setVolume(val);
        iconVolume.className = val > 50 ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-low';
      }
    });
  }

  // Playback speed
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      if (!ytPlayer || typeof ytPlayer.setPlaybackRate !== 'function') return;
      ytPlayer.setPlaybackRate(parseFloat(e.target.value));
    });
  }

  // Fullscreen
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      const elem = document.getElementById('fullPlayerSection') || container;
      if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Anti-download & anti-inspect guards
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showWarningToast('Контекстное меню и скачивание защищены!');
    return false;
  });

  // Block keyboard skip shortcuts (ArrowRight, L, J)
  window.addEventListener('keydown', (e) => {
    // Only capture if not inside an input/textarea
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'ArrowRight' || e.code === 'KeyL') {
      e.preventDefault();
      showWarningToast('Перемотка вперед заблокирована!');
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyJ') {
      e.preventDefault();
      rewind5Seconds();
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    }
  });

  // Save progress before user unloads page
  window.addEventListener('beforeunload', () => {
    syncProgress();
  });
})();
