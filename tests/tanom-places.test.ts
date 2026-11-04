import assert from "node:assert/strict";
import test from "node:test";
import places from "../lib/tanom/cebu-places.json";
import { findMunicipality } from "../lib/tanom/geography";

test("bundled settlement points have unique IDs and valid municipality assignments", () => {
  assert.ok(places.length > 0);
  assert.equal(new Set(places.map(place => place.id)).size, places.length);
  for (const place of places) {
    assert.ok(place.name.trim());
    assert.equal(findMunicipality(place)?.properties.id, place.municipalityId);
  }
});
