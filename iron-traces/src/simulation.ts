import { LEVELS, type Level } from "./campaigns";
export type Ammo = "AP" | "HE";
export type Phase = "briefing" | "playing" | "paused" | "victory" | "defeat";
export interface Point {
  x: number;
  z: number;
}
export interface Rect extends Point {
  w: number;
  d: number;
}
export interface Tank extends Point {
  id: number;
  angle: number;
  turret: number;
  hp: number;
  maxHp?: number;
  speed: number;
  reload: number;
  alive: boolean;
  shot: number;
  lastHit: number;
  stuck: number;
}
export interface Wall extends Rect {
  id: number;
  hp: number;
}
export interface Bullet extends Point {
  id: number;
  vx: number;
  vz: number;
  life: number;
  owner: number;
  ammo: Ammo;
}
export interface Event extends Point {
  type: "fire" | "hit" | "wall" | "destroy" | "supply" | "victory";
  owner?: number;
  ammo?: Ammo;
}
export interface Input {
  forward: number;
  turn: number;
  aim: number;
  fire: boolean;
  supply: boolean;
}
export const SIZE = 512,
  STEP = 1 / 60;
export const FORESTS: Rect[] = [];
export const BUILDINGS: Rect[] = [];
export const WATER: Rect[] = [];
export const BRIDGES: Rect[] = [];
export const ROAD_X:number[] = [], ROAD_Z:number[] = [];
export const SWAMP = {x:0,z:0,rx:1,rz:1};
export const SPAWN = {x:0,z:0}, SUPPLY = {x:0,z:0}, OBJECTIVE = {x:0,z:0};
let activeLevel:Level = LEVELS[0];
export function getActiveLevel(){return activeLevel;}
export function activateLevel(id:string):Level {
 const level=LEVELS.find(level=>level.id===id);
 if(!level) throw new Error(`Unknown campaign: ${id}`);
 activeLevel=level;
 FORESTS.splice(0,FORESTS.length,...level.forests);
 BUILDINGS.splice(0,BUILDINGS.length,...level.buildings);
 WATER.splice(0,WATER.length,...level.water);
 BRIDGES.splice(0,BRIDGES.length,...level.bridges);
 ROAD_X.splice(0,ROAD_X.length,...level.roadsX);
 ROAD_Z.splice(0,ROAD_Z.length,...level.roadsZ);
 Object.assign(SPAWN,level.spawn);Object.assign(SUPPLY,level.supply);
 Object.assign(OBJECTIVE,level.objective);Object.assign(SWAMP,level.swamp);
 return level;
}
activateLevel("normandy");
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const angleDiff = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const heading = (a: Point, b: Point) => Math.atan2(b.x - a.x, b.z - a.z);
export const heightAt = (x: number, z: number) =>
  0.15 * Math.sin(x * 0.14) * Math.cos(z * 0.11) +
  0.07 * Math.sin(z * 0.32 + x * 0.1);
export function inRect(p: Point, r: Rect, pad = 0) {
  return (
    Math.abs(p.x - r.x) < r.w / 2 + pad && Math.abs(p.z - r.z) < r.d / 2 + pad
  );
}
export function inSwamp(x: number, z: number) {
  return ((x - SWAMP.x) / SWAMP.rx) ** 2 + ((z - SWAMP.z) / SWAMP.rz) ** 2 < 1;
}
export function terrainFactor(t: Tank) {
  let wet = 0;
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const x =
        t.x + Math.cos(t.angle) * side * 1.1 + Math.sin(t.angle) * end * 1.4;
      const z =
        t.z - Math.sin(t.angle) * side * 1.1 + Math.cos(t.angle) * end * 1.4;
      if (inSwamp(x, z)) wet++;
    }
  return 1 - (0.55 * wet) / 4;
}
export function segmentRect(
  a: Point,
  b: Point,
  r: Rect,
  pad = 0,
): number | null {
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "z"] as const) {
    const half = (axis === "x" ? r.w : r.d) / 2 + pad,
      delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] < r[axis] - half || a[axis] > r[axis] + half) return null;
    } else {
      let t0 = (r[axis] - half - a[axis]) / delta,
        t1 = (r[axis] + half - a[axis]) / delta;
      if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return null;
    }
  }
  return lo;
}
export function segmentCircle(
  a: Point,
  b: Point,
  c: Point,
  r: number,
): number | null {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    ox = a.x - c.x,
    oz = a.z - c.z,
    A = dx * dx + dz * dz,
    C = ox * ox + oz * oz - r * r;
  if (C <= 0) return 0;
  if (A < 1e-10) return null;
  const B = 2 * (ox * dx + oz * dz),
    D = B * B - 4 * A * C;
  if (D < 0) return null;
  const t = (-B - Math.sqrt(D)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
/** Separating-axis test for the rotated hull against solid scenery. */
export function hullHits(p: Point, angle: number, r: Rect) {
  const dx = p.x - r.x,
    dz = p.z - r.z,
    c = Math.cos(angle),
    s = Math.sin(angle),
    ac = Math.abs(c),
    as = Math.abs(s),
    hw = 1.48,
    hl = 2.35;
  return (
    Math.abs(dx) < r.w / 2 + hw * ac + hl * as &&
    Math.abs(dz) < r.d / 2 + hw * as + hl * ac &&
    Math.abs(dx * c - dz * s) < hw + (r.w / 2) * ac + (r.d / 2) * as &&
    Math.abs(dx * s + dz * c) < hl + (r.w / 2) * as + (r.d / 2) * ac
  );
}
function tank(
  id: number,
  x: number,
  z: number,
  angle: number,
  hp: number,
): Tank {
  return {
    id,
    x,
    z,
    angle,
    turret: angle,
    hp,
    maxHp: hp,
    speed: 0,
    reload: id === 0 ? 0 : 4 + id,
    alive: true,
    shot: 0,
    lastHit: -99,
    stuck: 0,
  };
}
export class Simulation {
  readonly level = activeLevel;
  reloadDuration = 0;
  phase: Phase = "briefing";
  time = 0;
  player = tank(0, SPAWN.x, SPAWN.z, Math.PI, 100);
  enemies = this.level.enemies.map((e,i)=>tank(i+1,e.x,e.z,i===1?.1:0,e.hp));
  walls: Wall[] = [];
  bullets: Bullet[] = [];
  events: Event[] = [];
  ammo: Record<Ammo, number> = { AP: 14, HE: 22 };
  selected: Ammo = "HE";
  upgraded: Ammo | null = null;
  kills = 0;
  shots = 0;
  hits = 0;
  capture = 0;
  supplyProgress = 0;
  supplyUses = 0;
  nextBullet = 1;
  awareness = new Map<number, { x: number; z: number; until: number }>();
  routes = new Map<number, { until: number; points: Point[] }>();
  constructor(upgraded: Ammo | null = null) {
    this.upgraded = upgraded;
    this.walls=this.level.walls.map((w,id)=>({...w,id}));
  }
  start() {
    if (this.phase === "briefing") this.phase = "playing";
  }
  pause() {
    if (this.phase === "playing") this.phase = "paused";
  }
  resume() {
    if (this.phase === "paused") this.phase = "playing";
  }
  select(ammo: Ammo) {
    if (this.phase !== "playing") return;
    if (this.selected !== ammo) {
      this.selected = ammo;
      if (this.player.reload < 1.2) this.reloadDuration = 1.2;
      this.player.reload = Math.max(this.player.reload, 1.2);
    }
  }
  blocked(p: Point, who: number, angle?: number) {
    const t = [this.player, ...this.enemies].find((t) => t.id === who),
      a = angle ?? t?.angle ?? 0;
    if (Math.abs(p.x) > SIZE / 2 - 4.5 || Math.abs(p.z) > SIZE / 2 - 4.5)
      return true;
    if (
      [...FORESTS, ...BUILDINGS, ...WATER, ...this.walls.filter((w) => w.hp > 0)].some(
        (r) => hullHits(p, a, r),
      )
    )
      return true;
    return [this.player, ...this.enemies].some(
      (t) => t.id !== who && distance(p, t) < 3.4,
    );
  }
  /** A small four-neighbour route keeps enemies from endlessly pushing a wall. */
  route(e: Tank, target: Point = this.player) {
    const cell = 4,
      N = Math.floor((SIZE - 8) / cell),
      origin = ((N - 1) * cell) / 2,
      index = (p: Point) =>
        clamp(Math.round((p.z + origin) / cell), 0, N - 1) * N +
        clamp(Math.round((p.x + origin) / cell), 0, N - 1),
      point = (i: number) => ({
        x: (i % N) * cell - origin,
        z: Math.floor(i / N) * cell - origin,
      });
    const start = index(e),
      goal = index(target),
      queue = [start],
      parents = new Map<number, number>();
    parents.set(start, -1);
    let best = start,
      bestDistance = distance(point(start), target);
    const solids = [
      ...FORESTS,
      ...BUILDINGS,
      ...WATER,
      ...this.walls.filter((w) => w.hp > 0),
    ];
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q],
        pt = point(at),
        d = distance(pt, target);
      if (d < bestDistance) {
        best = at;
        bestDistance = d;
      }
      if (at === goal) {
        best = at;
        break;
      }
      const x = at % N,
        z = Math.floor(at / N);
      for (const [nx, nz] of [
        [x - 1, z],
        [x + 1, z],
        [x, z - 1],
        [x, z + 1],
      ]) {
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        const next = nz * N + nx;
        if (
          parents.has(next) ||
          solids.some((r) => inRect(point(next), r, 2.65))
        )
          continue;
        parents.set(next, at);
        queue.push(next);
      }
    }
    const points: Point[] = [];
    for (let at = best; at !== start && at !== -1; at = parents.get(at) ?? -1)
      points.unshift(point(at));
    return points;
  }
  lineClear(a: Point, b: Point) {
    return (
      !this.walls.some((w) => w.hp > 0 && segmentRect(a, b, w) !== null) &&
      ![...FORESTS, ...BUILDINGS].some((r) => segmentRect(a, b, r) !== null)
    );
  }
  move(t: Tank, forward: number, turn: number, dt: number) {
    const factor = terrainFactor(t);
    const nextAngle = t.angle + turn * 1.05 * factor * dt;
    if (!this.blocked(t, t.id, nextAngle)) t.angle = nextAngle;
    const target = forward * (forward >= 0 ? 7.4 : 4.1) * factor;
    const accel = forward === 0 ? 5 : 2.9;
    t.speed += clamp(target - t.speed, -accel * dt, accel * dt);
    const nx = t.x + Math.sin(t.angle) * t.speed * dt,
      nz = t.z + Math.cos(t.angle) * t.speed * dt;
    if (!this.blocked({ x: nx, z: nz }, t.id)) {
      t.x = nx;
      t.z = nz;
      t.stuck = 0;
    } else {
      t.speed = 0;
      t.stuck += dt;
    }
  }
  fire(t: Tank, ammo: Ammo) {
    if (!t.alive || t.reload > 0) return false;
    if (t.id === 0 && this.ammo[ammo] <= 0) return false;
    if (t.id === 0) {
      this.ammo[ammo]--;
      this.shots++;
      this.supplyProgress = 0;
    }
    t.reload = t.id === 0 ? (this.upgraded === ammo ? 4.8 : 5.2) : 7.2;
    if (t.id === 0) this.reloadDuration = t.reload;
    t.shot = this.time;
    const s = Math.sin(t.turret),
      c = Math.cos(t.turret);
    this.bullets.push({
      id: this.nextBullet++,
      x: t.x + s * 0.6,
      z: t.z + c * 0.6,
      vx: s * 65,
      vz: c * 65,
      life: 1.6,
      owner: t.id,
      ammo,
    });
    this.events.push({
      type: "fire",
      x: t.x + s * 3.7,
      z: t.z + c * 3.7,
      owner: t.id,
      ammo,
    });
    return true;
  }
  step(input: Input, dt = STEP) {
    if (this.phase !== "playing") return;
    this.time += dt;
    const p = this.player;
    for (const t of [p, ...this.enemies]) t.reload = Math.max(0, t.reload - dt);
    this.move(p, input.forward, input.turn, dt);
    p.turret += clamp(angleDiff(input.aim, p.turret), -1.45 * dt, 1.45 * dt);
    if (input.fire) this.fire(p, this.selected);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = distance(e, p), clear = this.lineClear(e, p);
      const seen = p.alive && d < 125 && clear;
      // Engines can be heard nearby; firing attracts attention farther away.
      const heard = p.alive && (d < 42 || (this.shots > 0 && this.time-p.shot < .35 && d < 150));
      if (seen || heard) this.awareness.set(e.id, {
        x: seen ? p.x : Math.round(p.x/10)*10,
        z: seen ? p.z : Math.round(p.z/10)*10,
        until: this.time + 9,
      });
      const memory = this.awareness.get(e.id);
      if (!memory || memory.until < this.time || !p.alive) { this.move(e,0,0,dt); continue; }
      const lead = seen ? Math.min(1.3,d/65)*.8 : 0;
      const aim = {x:memory.x + Math.sin(p.angle)*p.speed*lead,z:memory.z + Math.cos(p.angle)*p.speed*lead};
      const a = heading(e, aim);
      e.turret += clamp(angleDiff(a,e.turret),-1.0*dt,1.0*dt);
      if (!seen || d > 65) {
        let path=this.routes.get(e.id);
        if (!path || path.until<this.time) {
          path={until:this.time+.9,points:this.route(e,memory)};this.routes.set(e.id,path);
        }
        while(path.points.length && distance(e,path.points[0])<1.8)path.points.shift();
        const desired=path.points.length?heading(e,path.points[0]):heading(e,memory);
        const delta=angleDiff(desired,e.angle);
        this.move(e,e.stuck>.5?-.35:distance(e,memory)<4?0:Math.abs(delta)<.65?.55:0,clamp(delta*2,-1,1),dt);
      } else this.move(e,0,0,dt);
      const allyBlocks=this.enemies.some(other=>other.id!==e.id && segmentCircle(e,aim,other,2.2)!==null);
      if(seen && d<92 && !allyBlocks && this.lineClear(e,aim) && Math.abs(angleDiff(a,e.turret))<.055)this.fire(e,"AP");
    }

    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      const end = { x: b.x + b.vx * dt, z: b.z + b.vz * dt };
      let first = 2;
      let wall: Wall | undefined,
        hitTank: Tank | undefined,
        forest = false;
      for (const w of this.walls) {
        if (w.hp <= 0) continue;
        const t = segmentRect(b, end, w);
        if (t !== null && t < first) {
          first = t;
          wall = w;
          hitTank = undefined;
          forest = false;
        }
      }
      for (const r of [...FORESTS, ...BUILDINGS]) {
        const t = segmentRect(b, end, r);
        if (t !== null && t < first) {
          first = t;
          wall = undefined;
          hitTank = undefined;
          forest = true;
        }
      }
      for (const tnk of [p, ...this.enemies]) {
        if (tnk.id === b.owner) continue;
        const t = segmentCircle(b, end, tnk, 1.7);
        if (t !== null && t < first) {
          first = t;
          wall = undefined;
          hitTank = tnk;
          forest = false;
        }
      }
      if (first <= 1) {
        b.x += (end.x - b.x) * first;
        b.z += (end.z - b.z) * first;
        b.life = 0;
        if (wall) {
          wall.hp = Math.max(0, wall.hp - (b.ammo === "HE" ? 75 : 28));
          this.events.push({
            type: wall.hp === 0 ? "destroy" : "wall",
            x: b.x,
            z: b.z,
            ammo: b.ammo,
          });
        }
        if (hitTank) {
          const friendly = b.owner !== 0 && hitTank.id !== 0;
          if (hitTank.alive && !friendly) {
            const rear = Math.cos(
              heading(hitTank, { x: b.x - b.vx, z: b.z - b.vz }) -
                hitTank.angle,
            );
            const damage =
              b.owner === 0
                ? b.ammo === "HE"
                  ? 16
                  : rear > 0.5
                    ? 34
                    : rear < -0.5
                      ? 62
                      : 48
                : 18;
            hitTank.hp = Math.max(0, hitTank.hp - damage);
            hitTank.lastHit = this.time;
            if (b.owner===0 && hitTank.id!==0) {
              this.awareness.set(hitTank.id,{x:p.x,z:p.z,until:this.time+12});
              this.routes.delete(hitTank.id);
            }
            if (b.owner === 0) this.hits++;
            if (hitTank.id === 0) this.supplyProgress = 0;
            if (hitTank.hp === 0) {
              hitTank.alive = false;
              hitTank.speed = 0;
              if (hitTank.id !== 0) this.kills++;
            }
            this.events.push({
              type: hitTank.alive ? "hit" : "destroy",
              x: b.x,
              z: b.z,
              ammo: b.ammo,
              owner: hitTank.id,
            });
          } else this.events.push({ type: "wall", x: b.x, z: b.z });
        }
        if (forest) this.events.push({ type: "wall", x: b.x, z: b.z });
      } else {
        b.x = end.x;
        b.z = end.z;
        b.life -= dt;
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    const needsSupply = p.hp < 100 || this.ammo.AP < 14 || this.ammo.HE < 22;
    if (
      input.supply &&
      !input.fire &&
      Math.abs(p.speed) < 0.12 &&
      this.supplyUses < 2 &&
      distance(p, SUPPLY) < 5 &&
      this.time - p.lastHit > dt &&
      needsSupply
    ) {
      this.supplyProgress += dt;
      if (this.supplyProgress >= 8) {
        let available = 12;
        for (let i = 0; i < 12; i++) {
          const a: Ammo = this.ammo.AP / 14 < this.ammo.HE / 22 ? "AP" : "HE";
          if (this.ammo[a] < (a === "AP" ? 14 : 22)) {
            this.ammo[a]++;
            available--;
          } else {
            const other: Ammo = a === "AP" ? "HE" : "AP";
            if (this.ammo[other] < (other === "AP" ? 14 : 22)) {
              this.ammo[other]++;
              available--;
            }
          }
          if (available === 0) break;
        }
        p.hp = Math.min(100, p.hp + 35);
        this.supplyUses++;
        this.supplyProgress = 0;
        this.events.push({ type: "supply", ...SUPPLY });
      }
    } else this.supplyProgress = 0;
    if (
      this.kills === this.enemies.length &&
      distance(p, OBJECTIVE) < 6 &&
      Math.abs(p.speed) < 0.6
    )
      this.capture += dt;
    else this.capture = Math.max(0, this.capture - dt * 0.5);
    if (!p.alive) this.phase = "defeat";
    else if (this.capture >= this.level.captureSeconds) {
      this.phase = "victory";
      this.events.push({ type: "victory", ...p });
    }
  }
  drain() {
    return this.events.splice(0);
  }
}
