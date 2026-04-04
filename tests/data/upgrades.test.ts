import { describe, it, expect } from "vitest";
import { UPGRADE_CARDS, buildDrawPool, drawCards } from "@/data/upgrades";

describe("upgrade cards", () => {
  it("every card has id, name, description, rarity, and apply", () => {
    for (const card of UPGRADE_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(["common", "uncommon", "rare"]).toContain(card.rarity);
      expect(typeof card.apply).toBe("function");
    }
  });

  it("all card ids are unique", () => {
    const ids = UPGRADE_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("buildDrawPool weights commons more than rares", () => {
    const pool = buildDrawPool();
    const fireRateCount = pool.filter(c => c.id === "fireRate").length;
    const gravResistCount = pool.filter(c => c.id === "gravResist").length;
    expect(fireRateCount).toBe(3);
    expect(gravResistCount).toBe(1);
  });

  it("drawCards returns n distinct cards", () => {
    const cards = drawCards(3);
    expect(cards).toHaveLength(3);
    const ids = cards.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("drawCards never returns more cards than unique cards exist", () => {
    const cards = drawCards(999);
    expect(cards.length).toBeLessThanOrEqual(UPGRADE_CARDS.length);
  });
});
