/** Decorative cover footage: play once per menu visit and keep its final frame. */
export class MenuHeroVideo {
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private active = false;
  private finished = false;
  private failed = false;
  private playAttempt = 0;
  private frameRequest: number | undefined;

  constructor(private readonly video: HTMLVideoElement) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.addEventListener('playing', () => this.revealFrame());
    video.addEventListener('ended', () => { this.finished = true; });
    video.addEventListener('error', () => {
      this.failed = true;
      this.pause();
      video.classList.remove('is-ready');
    });
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) video.classList.remove('is-ready');
      this.sync();
    });
    document.addEventListener('visibilitychange', () => this.sync());
    window.addEventListener('pagehide', () => this.pause());
    window.addEventListener('pageshow', () => this.sync());
  }

  show() {
    this.active = true;
    this.finished = false;
    this.pause();
    this.video.classList.remove('is-ready');
    // A previous load failure may be transient; retry on the next menu visit.
    if (this.failed) {
      this.failed = false;
      this.video.removeAttribute('src');
      this.video.load();
    } else if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.video.currentTime = 0;
    }
    this.sync();
  }

  hide() {
    this.active = false;
    this.pause();
  }

  private pause() {
    this.playAttempt++;
    this.video.pause();
    if (this.frameRequest !== undefined) {
      this.video.cancelVideoFrameCallback(this.frameRequest);
      this.frameRequest = undefined;
    }
  }

  private sync() {
    if (!this.active || document.hidden || this.motion.matches) {
      this.pause();
      return;
    }
    if (this.failed) return;
    if (this.finished) {
      // Motion preference changes can hide the final frame without unloading it.
      this.video.classList.add('is-ready');
      return;
    }
    // Keep the original cover visible and avoid loading footage for reduced motion.
    if (!this.video.getAttribute('src')) this.video.src = './videos/campaign-approach.mp4';
    const attempt = ++this.playAttempt;
    void this.video.play().catch(() => {
      if (attempt !== this.playAttempt) return;
      this.failed = true;
      this.video.classList.remove('is-ready');
    });
  }

  private revealFrame() {
    const reveal = () => {
      this.frameRequest = undefined;
      if (this.active && !document.hidden && !this.motion.matches && !this.failed) {
        this.video.classList.add('is-ready');
      }
    };
    if (this.frameRequest !== undefined) this.video.cancelVideoFrameCallback(this.frameRequest);
    if ('requestVideoFrameCallback' in this.video) {
      this.frameRequest = this.video.requestVideoFrameCallback(reveal);
    } else {
      reveal();
    }
  }
}
