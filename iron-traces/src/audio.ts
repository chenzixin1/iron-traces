import { distance, type Event, type Tank, type Point } from "./simulation";
import { damageState } from "./damage";
type Voice = {
  source: AudioBufferSourceNode;
  pan: PannerNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  position: Point;
  base: number;
};
const FILES = [
  "cannon-1",
  "cannon-2",
  "cannon-3",
  "explosion",
  "engine",
  "fire",
  "metal",
] as const;
export class BattleAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true; // Each page visit starts with sound enabled; mute remains a session choice.
  interior = false;
  voices = 0;
  buffers = new Map<string, AudioBuffer>();
  failed: string[] = [];
  private loading: Promise<void> | null = null;
  private bus: GainNode | null = null;
  private cabin: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private loops = new Map<string, Voice>();
  private shots = new Set<Voice>();
  private listener = { x: 0, z: 0, fx: 0, fz: -1 };
  private playing = false;
  private testGeneration = 0;
  private lastOcclusion = 0;
  private lastTime = 0;
  async start() {
    if (!this.ctx) {
      const ctx = (this.ctx = new AudioContext());
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.cabin = ctx.createBiquadFilter();
      this.cabin.type = "lowpass";
      this.cabin.frequency.value = 20000;
      this.cabin.Q.value = 0.4;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      this.bus.connect(this.cabin);
      this.cabin.connect(limiter);
      limiter.connect(this.master);
      this.master.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let v = 0;
      for (let i = 0; i < data.length; i++) {
        v = (v + (Math.random() * 2 - 1) * 0.08) / 1.025;
        data[i] = v;
      }
      this.loading = Promise.allSettled(
        FILES.map(async (name) => {
          const res = await fetch(
            `${import.meta.env.BASE_URL}audio/${name}.mp3`,
          );
          if (!res.ok) throw new Error(name);
          this.buffers.set(
            name,
            await ctx.decodeAudioData(await res.arrayBuffer()),
          );
        }),
      ).then((results) => {
        this.failed = results.flatMap((r, i) =>
          r.status === "rejected" ? [FILES[i]] : [],
        );
      });
    }
    await this.ctx.resume();
    await this.loading;
  }
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem("iron-traces-muted", String(!this.enabled)); } catch {}
    if (this.ctx)
      this.master!.gain.setTargetAtTime(
        this.enabled ? 0.55 : 0,
        this.ctx.currentTime,
        0.06,
      );
  }
  private make(
    name: string,
    p: Point,
    base: number,
    loop = false,
    test = false,
  ): Voice | null {
    if (!this.ctx || !this.bus || this.voices >= 28) return null;
    const ctx = this.ctx,
      source = ctx.createBufferSource(),
      pan = ctx.createPanner(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.buffers.get(name) ?? this.noise;
    source.loop = loop;
    pan.panningModel = "HRTF";
    pan.distanceModel = "inverse";
    pan.refDistance =
      name.startsWith("cannon") || name === "explosion" ? 12 : 4;
    pan.rolloffFactor = 1;
    pan.maxDistance = 320;
    pan.positionX.value = p.x;
    pan.positionY.value = 1.7;
    pan.positionZ.value = p.z;
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    filter.frequency.value = 18000;
    gain.gain.value = loop ? 0 : base;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(test ? this.master! : this.bus);
    const voice = { source, pan, filter, gain, position: { ...p }, base };
    this.voices++;
    source.onended = () => {
      this.voices--;
      this.shots.delete(voice);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start();
    return voice;
  }
  private stop(v: Voice) {
    v.source.stop();
  }
  reset() {
    this.testGeneration++;
    for (const v of this.loops.values()) this.stop(v);
    this.loops.clear();
    for (const v of this.shots) this.stop(v);
    this.shots.clear();
  }
  update(
    t: Tank,
    playing: boolean,
    wet: boolean,
    interior: boolean,
    enemies: Tank[],
    forward: Point,
    clear: (a: Point, b: Point) => boolean,
    time: number,
  ) {
    this.interior = interior;
    if (!this.ctx) return;
    const now = this.ctx.currentTime,
      l = this.ctx.listener;
    if (time < this.lastTime) this.reset();
    this.lastTime = time;
    const len = Math.hypot(forward.x, forward.z) || 1;
    this.listener = {
      x: t.x,
      z: t.z,
      fx: forward.x / len,
      fz: forward.z / len,
    };
    l.positionX.value = t.x;
    l.positionY.value = 1.7;
    l.positionZ.value = t.z;
    l.forwardX.value = this.listener.fx;
    l.forwardY.value = 0;
    l.forwardZ.value = this.listener.fz;
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
    this.cabin!.frequency.setTargetAtTime(interior ? 1600 : 20000, now, 0.12);
    this.bus!.gain.setTargetAtTime(playing ? 1 : 0, now, 0.035);
    if (!playing && this.playing) {
      for (const v of this.shots) this.stop(v);
      this.shots.clear();
    }
    this.playing = playing;
    const wanted = new Set<string>();
    for (const tank of [t, ...enemies]) {
      if (distance(t, tank) > 100) continue;
      const state = damageState(tank),
        burn = state === "burning" || state === "wreck";
      for (const name of ["engine", "fire"]) {
        if (
          name === "engine"
            ? !tank.alive
            : !burn || (!tank.alive && time - tank.lastHit > 65)
        )
          continue;
        const key = `${tank.id}-${name}`;
        wanted.add(key);
        let v = this.loops.get(key);
        if (!v && this.buffers.has(name)) {
          v = this.make(name, tank, 1, true) ?? undefined;
          if (v) this.loops.set(key, v);
        }
        if (!v) continue;
        v.position = { x: tank.x, z: tank.z };
        v.pan.positionX.value = tank.x;
        v.pan.positionZ.value = tank.z;
        const speed = Math.abs(tank.speed);
        v.base =
          name === "engine"
            ? (tank.id === 0 ? 0.24 : 0.65) * (1 + speed * 0.065)
            : 0.5;
        v.gain.gain.setTargetAtTime(playing ? v.base : 0, now, 0.12);
        v.source.playbackRate.setTargetAtTime(
          name === "engine"
            ? 0.78 + speed * (wet && tank.id === 0 ? 0.045 : 0.065)
            : 1,
          now,
          0.15,
        );
      }
    }
    for (const [key, v] of this.loops)
      if (!wanted.has(key)) {
        this.stop(v);
        this.loops.delete(key);
      }
    if (now - this.lastOcclusion > 0.12) {
      this.lastOcclusion = now;
      for (const v of [...this.loops.values(), ...this.shots]) {
        const d = distance(t, v.position),
          blocked = d > 4 && !clear(t, v.position);
        v.filter.frequency.setTargetAtTime(
          blocked ? 900 : Math.max(1600, 18000 / (1 + d * 0.02)),
          now,
          0.08,
        );
      }
    }
  }
  effect(e: Event) {
    if (!this.ctx || !this.enabled) return;
    if (e.type === "supply" || e.type === "victory") {
      const ctx = this.ctx,
        source = ctx.createOscillator(),
        gain = ctx.createGain(),
        now = ctx.currentTime;
      source.frequency.setValueAtTime(523, now);
      source.frequency.setValueAtTime(659, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      source.connect(gain);
      gain.connect(this.master!);
      source.start();
      source.stop(now + 0.5);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      return;
    }
    const firing = e.type === "fire",
      destroy = e.type === "destroy";
    const name = firing
      ? `cannon-${1 + Math.floor(Math.random() * 3)}`
      : e.type === "hit"
        ? "metal"
        : "explosion";
    const v = this.make(name, e, destroy ? 1 : firing ? 0.8 : 0.32);
    if (!v) return;
    v.source.playbackRate.value = destroy
      ? 0.86
      : firing
        ? 0.97 + Math.random() * 0.06
        : e.type === "hit"
          ? 0.72
          : 1.55;
    if (!destroy && !firing) v.source.stop(this.ctx.currentTime + 0.6);
    this.shots.add(v);
  }
  async testHeadphones() {
    await this.start();
    const generation = ++this.testGeneration;
    if (!this.enabled) this.toggle();
    const { x, z, fx, fz } = this.listener;
    // forward × up is camera right in the game's +Z-forward world.
    const points = [
      { x: x + fz * 8, z: z - fx * 8 },
      { x: x - fz * 8, z: z + fx * 8 },
    ];
    for (let i = 0; i < 2; i++)
      setTimeout(() => {
        if (generation !== this.testGeneration || this.playing) return;
        const v = this.make("cannon-1", points[i], 0.4, false, true);
        if (v) {
          this.shots.add(v);
          v.source.stop(this.ctx!.currentTime + 0.65);
        }
      }, i * 1100);
  }
  inspect() {
    return {
      spatialModel: "HRTF",
      loaded: [...this.buffers.keys()],
      failed: [...this.failed],
      loops: this.loops.size,
      listener: { ...this.listener },
      sources: [...this.loops.entries()].map(([id, v]) => ({
        id,
        ...v.position,
        cutoff: v.filter.frequency.value,
      })),
    };
  }
}
