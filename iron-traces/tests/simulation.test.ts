import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  SIZE,
  SPAWN,
  OBJECTIVE,
  STEP,
  segmentRect,
  segmentCircle,
  terrainFactor,
  SUPPLY,
  FORESTS,
  BUILDINGS,
  type Ammo,
  type Input,
} from "../src/simulation";
const input: Input = {
  forward: 0,
  turn: 0,
  aim: Math.PI,
  fire: false,
  supply: false,
};
function advance(s: Simulation, t: number, patch: Partial<Input> = {}) {
  for (let i = 0; i < Math.ceil(t / STEP); i++) s.step({ ...input, ...patch });
}
function shootWall(ammo: Ammo) {
  const s = new Simulation();
  s.enemies = [];
  s.start();
  s.player.z = 9;
  s.player.turret = Math.PI;
  s.selected = ammo;
  return s;
}
test("briefing and pause freeze simulation, resume restores it", () => {
  const s = new Simulation();
  advance(s, 1, { forward: 1 });
  assert.equal(s.time, 0);
  s.start();
  advance(s, 1, { forward: 1 });
  assert.ok(s.player.z < SPAWN.z);
  const z = s.player.z,
    t = s.time;
  s.pause();
  advance(s, 2, { forward: 1 });
  assert.equal(s.time, t);
  assert.equal(s.player.z, z);
  s.resume();
  advance(s, 1, { forward: 1 });
  assert.ok(s.player.z < z);
});
test("continuous collision finds thin wall and circle even at high speed", () => {
  assert.ok(
    segmentRect(
      { x: 0, z: 10 },
      { x: 0, z: -20 },
      { x: 0, z: 3, w: 3, d: 0.1 },
    )! < 1,
  );
  assert.equal(
    segmentRect(
      { x: 5, z: 10 },
      { x: 5, z: -20 },
      { x: 0, z: 3, w: 3, d: 0.1 },
    ),
    null,
  );
  assert.ok(
    segmentCircle({ x: 0, z: 10 }, { x: 0, z: -20 }, { x: 0, z: 0 }, 1)! < 1,
  );
});
test("HE takes exactly two hits; shell destroying wall does not pass through", () => {
  const s = shootWall("HE");
  s.enemies = [{ ...s.player, id: 1, x: 0, z: 0, hp: 80, reload: 99 }];
  s.fire(s.player, "HE");
  advance(s, 0.15);
  assert.equal(s.walls[3].hp, 45);
  s.player.reload = 0;
  s.fire(s.player, "HE");
  advance(s, 0.3);
  assert.equal(s.walls[3].hp, 0);
  assert.equal(s.enemies[0].hp, 80);
  assert.equal(s.bullets.length, 0);
});
test("AP takes exactly five hits against brick", () => {
  const s = shootWall("AP");
  for (let i = 0; i < 4; i++) {
    s.player.reload = 0;
    s.fire(s.player, "AP");
    advance(s, 0.15);
  }
  assert.equal(s.walls[3].hp, 8);
  s.player.reload = 0;
  s.fire(s.player, "AP");
  advance(s, 0.15);
  assert.equal(s.walls[3].hp, 0);
});
test("ammunition, reload and upgrade enforce fire cadence", () => {
  const s = new Simulation("AP");
  s.start();
  assert.equal(s.fire(s.player, "AP"), true);
  assert.equal(s.player.reload, 4.8);
  assert.equal(s.ammo.AP, 13);
  assert.equal(s.fire(s.player, "AP"), false);
  s.player.reload = 0;
  s.ammo.AP = 0;
  assert.equal(s.fire(s.player, "AP"), false);
  s.fire(s.player, "HE");
  assert.equal(s.player.reload, 5.2);
});
test("full swamp reduces movement and turning to 45 percent", () => {
  const a = new Simulation(),
    b = new Simulation();
  a.enemies = [];
  b.enemies = [];
  a.player.x = 8;
  a.player.z = 22;
  b.player.x = -10;
  b.player.z = 19;
  assert.equal(terrainFactor(b.player), 0.44999999999999996);
  a.start();
  b.start();
  advance(a, 1, { turn: 1 });
  advance(b, 1, { turn: 1 });
  assert.ok(
    Math.abs((b.player.angle - Math.PI) / (a.player.angle - Math.PI) - 0.45) <
      0.001,
  );
});
test("dense woods, buildings, map edges and tanks block passage", () => {
  const s = new Simulation();
  assert.equal(s.blocked(FORESTS[0], 0), true);
  assert.equal(s.blocked(BUILDINGS[0], 0), true);
  assert.equal(s.blocked({ x: SIZE / 2, z: 0 }, 0), true);
  assert.equal(s.blocked(s.enemies[0], 0), true);
  assert.equal(s.blocked({ x: 0, z: 20 }, 0), false);
});
test("tank stops at wall then passes through destroyed gap", () => {
  const s = shootWall("HE");
  advance(s, 3, { forward: 1 });
  assert.ok(s.player.z > 5.7);
  s.walls[3].hp = 0;
  advance(s, 3, { forward: 1 });
  assert.ok(s.player.z < 3);
});
test("supply cancels atomically then completes once and respects capacities", () => {
  const s = new Simulation();
  s.enemies = [];
  s.player.x = SUPPLY.x;
  s.player.z = SUPPLY.z;
  s.player.hp = 40;
  s.ammo = { AP: 10, HE: 12 };
  s.start();
  advance(s, 4, { supply: true });
  assert.equal(s.supplyUses, 0);
  advance(s, 0.1);
  assert.equal(s.supplyProgress, 0);
  assert.equal(s.player.hp, 40);
  advance(s, 8.1, { supply: true });
  assert.equal(s.supplyUses, 1);
  assert.equal(s.player.hp, 75);
  assert.equal(s.ammo.AP + s.ammo.HE, 34);
  assert.ok(s.ammo.AP <= 14 && s.ammo.HE <= 22);
});
test("player death, capture victory, and fresh retry are distinct", () => {
  const s = new Simulation();
  s.start();
  s.enemies.forEach((t) => (t.alive = false));
  s.kills = 3;
  s.player.x = 0;
  s.player.z = OBJECTIVE.z;
  advance(s, 5.1);
  assert.equal(s.phase, "victory");
  const fresh = new Simulation();
  assert.equal(fresh.phase, "briefing");
  assert.equal(fresh.kills, 0);
  assert.equal(fresh.walls[3].hp, 120);
  assert.equal(fresh.ammo.AP + fresh.ammo.HE, 36);
  fresh.start();
  fresh.player.alive = false;
  advance(fresh, 0.1);
  assert.equal(fresh.phase, "defeat");
});
test("hostile fire damages player, allied enemy shells are blocked without damage", () => {
  const s = new Simulation();
  s.start();
  s.walls = [];
  s.player.z = 10;
  s.enemies = [{ ...s.player, id: 1, z: 0, turret: 0, reload: 0 }];
  s.fire(s.enemies[0], "AP");
  advance(s, 0.2);
  assert.equal(s.player.hp, 82);
  const f = new Simulation();
  f.start();
  f.walls = [];
  f.player.x = 40;
  f.enemies = [
    { ...f.player, id: 1, x: 0, z: 0, turret: 0, reload: 0 },
    { ...f.player, id: 2, x: 0, z: 8, hp: 80, reload: 99 },
  ];
  f.fire(f.enemies[0], "AP");
  advance(f, 0.2);
  assert.equal(f.enemies[1].hp, 80);
});
test("enemy routes around an intact wall instead of driving through it", () => {
  const s = new Simulation();
  s.start();
  s.enemies[0].x = -12;
  s.enemies[0].z = -16;
  s.player.z = 18;
  s.player.hp = 10000;
  for (let i = 0; i < 2400; i++) s.step(input);
  const e = s.enemies[0];
  assert.ok(e.z > -16, "enemy should advance");
  assert.ok(
    !s.walls.some(
      (w) =>
        w.hp > 0 &&
        Math.abs(e.x - w.x) < w.w / 2 &&
        Math.abs(e.z - w.z) < w.d / 2,
    ),
    "enemy must not enter a wall",
  );
  assert.ok(e.shot > 0, "enemy must find a firing position");
});

test("large map routes connect spawn, side roads, supply and north objective", () => {
  const s = new Simulation();
  assert.equal(SIZE, 512);
  const start = { ...s.player };
  for (const destination of [
    SUPPLY,
    OBJECTIVE,
    { x: -128, z: 220 },
    { x: 128, z: -220 },
    { x: -115, z: 110 },
    { x: 115, z: -110 },
  ]) {
    Object.assign(s.player, destination);
    const route = s.route(start);
    assert.ok(route.length > 0);
    assert.ok(
      Math.hypot(
        route.at(-1)!.x - destination.x,
        route.at(-1)!.z - destination.z,
      ) < 4,
    );
  }
  for (const rect of [...FORESTS, ...BUILDINGS]) {
    assert.ok(Math.abs(rect.x) + rect.w / 2 < SIZE / 2);
    assert.ok(Math.abs(rect.z) + rect.d / 2 < SIZE / 2);
  }
});

test('enemy acquires and fires at visible player beyond old 40m limit',()=>{
  const s=new Simulation();s.start();s.player.hp=10000;
  const e=s.enemies[0];e.x=0;e.z=144;e.turret=0;e.reload=0;
  s.enemies.slice(1).forEach(t=>t.alive=false);
  for(let i=0;i<120;i++)s.step(input);
  assert.ok(e.shot>0,'visible target at 80m must receive fire');
  assert.ok(s.awareness.has(e.id));
});
test('solid wall blocks long-range vision; expired memory cannot track unseen player',()=>{
  const s=new Simulation();s.start();s.player.x=0;s.player.z=20;
  const e=s.enemies[0];e.x=0;e.z=-60;
  assert.equal(s.lineClear(e,s.player),false);
  s.step(input);assert.equal(s.awareness.has(e.id),false);
  s.awareness.set(e.id,{x:0,z:20,until:s.time-.1});
  const turret=e.turret;s.player.x=200;s.player.z=220;s.step(input);
  assert.equal(e.turret,turret);
});
