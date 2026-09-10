import { test } from "node:test";
import assert from "node:assert/strict";
import { nextView, showEnemyPositions, interiorAim } from "../src/view";
import { Simulation, STEP } from "../src/simulation";
test("C cycles all three cameras then returns to overhead", () => {
  assert.equal(nextView("overhead"), "shoulder");
  assert.equal(nextView("shoulder"), "interior");
  assert.equal(nextView("interior"), "overhead");
});
test("interior maps never expose enemy locations", () => {
  assert.equal(showEnemyPositions("interior"), false);
  assert.equal(showEnemyPositions("overhead"), true);
  assert.equal(showEnemyPositions("shoulder"), true);
});
test("interior traverse stops centrally, turns correctly and stays bounded", () => {
  const angle = Math.PI;
  assert.equal(interiorAim(angle, 0.1, STEP), angle);
  assert.equal(interiorAim(angle, -0.14, STEP), angle);
  assert.ok(interiorAim(angle, -1, STEP) > angle);
  assert.ok(interiorAim(angle, 1, STEP) < angle);
  assert.equal(interiorAim(angle, 20, STEP), interiorAim(angle, 1, STEP));
  assert.ok(Math.abs(interiorAim(angle, 1, 10) - angle) <= 0.073);
});
test("interior aim feeds actual turret rather than rotating only the view", () => {
  const s = new Simulation();
  s.enemies = [];
  s.start();
  for (let i = 0; i < 60; i++)
    s.step({
      forward: 0,
      turn: 0,
      aim: interiorAim(s.player.turret, 0.8, STEP),
      fire: false,
      supply: false,
    });
  assert.ok(s.player.turret < Math.PI - 0.5);
  const a = s.player.turret;
  for (let i = 0; i < 60; i++)
    s.step({
      forward: 0,
      turn: 0,
      aim: interiorAim(s.player.turret, 0, STEP),
      fire: false,
      supply: false,
    });
  assert.equal(s.player.turret, a);
  s.fire(s.player, "AP");
  assert.ok(
    Math.abs(Math.atan2(s.bullets[0].vx, s.bullets[0].vz) - s.player.turret) <
      0.001,
  );
});
