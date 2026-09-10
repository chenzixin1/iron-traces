import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEFINGS, chineseCount, historyMarkup } from "../src/briefings";
test("every battle briefing contains at least 500 Chinese characters of prose", () => {
  for (const b of BRIEFINGS) {
    assert.ok(
      chineseCount(b.sections.map((s) => s.text).join("")) >= 500,
      b.id,
    );
    assert.ok(b.sections.length >= 4);
    for (const section of b.sections) assert.ok(b.sources[section.source]);
  }
});

test("six campaign briefings can be selected by id or index", () => {
  assert.deepEqual(BRIEFINGS.map((b) => b.id), ["normandy-cobra", "falaise", "market-garden", "aachen", "ardennes", "remagen"]);
  BRIEFINGS.forEach((b, i) => {
    assert.ok(historyMarkup(b.id).includes(b.title));
    assert.equal(historyMarkup(i), historyMarkup(b.id));
    assert.equal((historyMarkup(i).match(/id="historyReader"/g) ?? []).length, 1);
    assert.ok(chineseCount(b.sections.slice(0, 4).map((section) => section.text).join("")) >= 500, b.id + " historical prose alone");
  });
  assert.equal(historyMarkup("missing"), historyMarkup());
  assert.equal(historyMarkup(99), historyMarkup());
});
