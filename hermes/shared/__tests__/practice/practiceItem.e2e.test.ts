// tests/practice/practiceItem.e2e.test.ts
import path from "path";
import fs from "fs";
import { practiceItemRegistry, registerPracticeItems } from "../../../shared/domain/practice";

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const ITEMS_DIR = path.join(FIXTURES_DIR, "items");
const SUBS_DIR = path.join(FIXTURES_DIR, "submissions");

describe("PracticeItem evaluators (construct + evaluate)", () => {
  beforeAll(() => {
    registerPracticeItems();
  });

  const itemFiles = fs.readdirSync(ITEMS_DIR).filter(f => f.endsWith(".json"));

  test.each(itemFiles)("%s", (fileName) => {
    const itemJson = readJson(path.join(ITEMS_DIR, fileName));

    const good = readJson(path.join(SUBS_DIR, `${itemJson.type}.good.json`));
    const bad  = readJson(path.join(SUBS_DIR, `${itemJson.type}.bad.json`));

    const item = practiceItemRegistry.create(itemJson);

    // metadata invariants (AC #1/#2)
    expect(item.type).toBe(itemJson.type);
    expect(item.mode).toBe(itemJson.mode);
    expect(item.skills).toEqual(itemJson.skills);
    expect(item.conceptIds.length).toBeGreaterThan(0);

    // good submission invariants
    const goodResult = item.evaluate(good);
    expect(goodResult.type).toBe(item.type);
    expect(goodResult.score).toBeGreaterThanOrEqual(0);
    expect(goodResult.score).toBeLessThanOrEqual(1);
    expect(goodResult.conceptResults.length).toBeGreaterThan(0);

    // bad submission invariants
    const badResult = item.evaluate(bad);
    expect(badResult.score).toBeGreaterThanOrEqual(0);
    expect(badResult.score).toBeLessThanOrEqual(1);
  });
});
