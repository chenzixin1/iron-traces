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
const FOLEY = ['impactMetal_heavy_000','impactMetal_heavy_001','impactMetal_heavy_002','impactMetal_light_000','impactPlate_heavy_000','impactMining_000','impactMining_001','impactWood_heavy_000','breech','sherman-drive'];
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
  private previousReload = 0;
  private trackTravel = new Map<number, number>();
  private reflections: DelayNode | null = null;
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
      // Quiet outdoor reflection, after positioning so left/right cues remain intact.
      this.reflections = ctx.createDelay(1);
      this.reflections.delayTime.value = .19;
      const echoFilter = ctx.createBiquadFilter(), echoGain = ctx.createGain();
      echoFilter.type='lowpass'; echoFilter.frequency.value=1800;
      echoGain.gain.value=.16;
      this.reflections.connect(echoFilter); echoFilter.connect(echoGain); echoGain.connect(this.bus);
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
        [...FILES,...FOLEY].map(async (name) => {
          const res = await fetch(
            `${import.meta.env.BASE_URL}audio/${FOLEY.includes(name) ? "foley/"+name+".ogg" : name+".mp3"}`,
          );
          if (!res.ok) throw new Error(name);
          this.buffers.set(
            name,
            await ctx.decodeAudioData(await res.arrayBuffer()),
          );
        }),
      ).then((results) => {
        this.failed = results.flatMap((r, i) =>
          r.status === "rejected" ? [[...FILES,...FOLEY][i]] : [],
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
    delay = 0,
    rate = 1,
  ): Voice | null {
    if (!this.ctx || !this.bus || this.voices >= (loop ? 18 : 48)) return null;
    const ctx = this.ctx,
      source = ctx.createBufferSource(),
      pan = ctx.createPanner(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.buffers.get(name === "engine" ? "sherman-drive" : name) ?? this.buffers.get(name) ?? this.noise;
    source.loop = loop;
    source.playbackRate.value = rate;
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
    if (!loop && !test && this.reflections && (name.startsWith('cannon') || name==='explosion')) pan.connect(this.reflections);
    source.start(ctx.currentTime + delay);
    return voice;
  }
  private stop(v: Voice) {
    v.source.stop();
  }
  reset() {
    this.testGeneration++;
    this.previousReload=0; this.trackTravel.clear();
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
    const dt=Math.max(0,Math.min(.05,time-this.lastTime));
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
    if(playing && this.enabled && t.alive){
      if(this.previousReload>0 && t.reload<=0) this.sample('breech',t,interior?.24:.10,0,.85);
    }
    this.previousReload=t.reload;
    const wanted = new Set<string>();
    for (const tank of [t, ...enemies]) {
      if (distance(t, tank) > 150) continue;
      if(playing && this.enabled && tank.alive && Math.abs(tank.speed)>.3 && distance(t,tank)<40){
        const travel=(this.trackTravel.get(tank.id)??0)+Math.abs(tank.speed)*dt;
        if(travel>.85){
          this.trackTravel.set(tank.id,travel%.85);
          this.sample('impactMetal_light_000',tank,tank.id===0?.045:.09*Math.max(0,1-distance(t,tank)/40),0,.55+Math.random()*.15);
          if(tank.id===0)this.sample(wet?'impactWood_heavy_000':'impactMining_001',tank,.045,0,.65+Math.random()*.1);
        }else this.trackTravel.set(tank.id,travel);
      }
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
            ? (tank.id === 0 ? 0.28 : 0.8) * (1 + speed * 0.065) * (tank.id===0 ? 1 : Math.max(0,Math.min(1,(150-distance(t,tank))/35)))
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
        const engine = [...this.loops.entries()].some(([key,voice])=>voice===v && key.endsWith('-engine'));
        const airCutoff=engine ? (d<4?8500:Math.max(450,8500*Math.exp(-d/28))) : Math.max(1600,18000/(1+d*.02));
        v.filter.frequency.setTargetAtTime(
          blocked ? Math.min(650,airCutoff) : airCutoff,
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
    const d=Math.hypot(e.x-this.listener.x,e.z-this.listener.z);
    const delay=Math.min(.8,d/343);
    if(e.type==='fire'){
      this.sample(`cannon-${1+Math.floor(Math.random()*3)}`,e,.78,delay,.96+Math.random()*.07);
      // Low, brief mechanical recoil under the muzzle report.
      this.sample('impactPlate_heavy_000',e,e.owner===0?.16:.08,delay+.025,.55);
      if(e.owner===0)this.sample('breech',e,this.interior?.20:.08,delay+.55,.8);
    }else if(e.type==='destroy'){
      this.sample('explosion',e,.95,delay,.82+Math.random()*.1);
      this.sample(e.owner===undefined?'impactMining_000':'impactMetal_heavy_002',e,.22,delay+.09,.65);
      this.sample('impactMining_001',e,.12,delay+.32,.72);
    }else if(e.type==='hit'){
      this.sample(`impactMetal_heavy_00${Math.floor(Math.random()*3)}`,e,.36,delay,.72+Math.random()*.18);
      this.sample('metal',e,.14,delay+.025,.85);
    }else if(e.type==='wall'){
      this.sample(Math.random()<.5?'impactMining_000':'impactMining_001',e,.30,delay,.85+Math.random()*.15);
    }
  }
  private sample(name:string,p:Point,gain:number,delay=0,rate=1){
    const v=this.make(name,p,gain,false,false,delay,rate);
    if(v)this.shots.add(v);
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
      activeVoices:this.voices,
      propagationSpeed:343,
      engineRecording:"Beeld en Geluid — Sherman tank: rijden / CC BY-SA 3.0",
      foleyLibrary:"Kenney Impact Sounds / CC0",
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
