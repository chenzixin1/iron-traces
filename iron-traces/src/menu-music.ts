/** John Michel recording, Ogg Vorbis from Wikimedia Commons, opening silence trimmed.
 * CC BY-SA 3.0 attribution and source are in public/audio/CREDITS.md.
 */
export class MenuMusic {
  private audio = new Audio('./audio/beethoven-allegretto-john-michel-trimmed.ogg');
  constructor() {
    this.audio.loop = true;
    this.audio.autoplay = true;
    this.audio.preload = 'auto';
    this.audio.volume = .45;
  }
  async play() { if (this.audio.paused) await this.audio.play(); }
  stop() { this.audio.pause(); }
  inspect() {
    return {
      loaded: this.audio.readyState >= 2,
      playing: !this.audio.paused,
      time: this.audio.currentTime,
      duration: this.audio.duration,
      source: 'Beethoven · Symphony 7 · Allegretto / John Michel / Trimmed OGG · CC BY-SA 3.0',
      error: this.audio.error?.message ?? null,
    };
  }
}
