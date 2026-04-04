import Phaser from "phaser";
import { COLORS } from "@/constants";
import { UpgradeManager } from "@/systems/UpgradeManager";
import { ResourceManager } from "@/systems/ResourceManager";
import { getTierForMass } from "@/data/tiers";
import type { UpgradeDefinition, UpgradeCategory } from "@/data/upgrades";

const PANEL_WIDTH = 280;
const ROW_HEIGHT = 36;
const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  weapon: "WEAPONS",
  automation: "AUTOMATION",
  energyGen: "ENERGY GEN",
  energyStorage: "ENERGY STORAGE",
  station: "STATION",
};

export class UpgradeShop {
  private scene: Phaser.Scene;
  private upgrades: UpgradeManager;
  private resources: ResourceManager;
  private container: Phaser.GameObjects.Container;
  private isOpen: boolean = false;
  private rows: Phaser.GameObjects.Container[] = [];

  constructor(
    scene: Phaser.Scene,
    upgrades: UpgradeManager,
    resources: ResourceManager
  ) {
    this.scene = scene;
    this.upgrades = upgrades;
    this.resources = resources;

    this.container = scene.add.container(
      scene.scale.width - PANEL_WIDTH - 10,
      60
    );
    this.container.setScrollFactor(0);
    this.container.setDepth(200);
    this.container.setVisible(false);

    // Toggle button
    scene.add
      .text(scene.scale.width - 100, 20, "[UPGRADES]", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#6c63ff",
      })
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.isOpen = !this.isOpen;
        this.container.setVisible(this.isOpen);
        if (this.isOpen) this.rebuild();
      });
  }

  rebuild(): void {
    for (const row of this.rows) row.destroy();
    this.rows = [];

    const tier = getTierForMass(this.resources.totalMassEarned);
    const available = this.upgrades.getAvailableUpgrades(tier);

    const bg = this.scene.add
      .rectangle(
        PANEL_WIDTH / 2,
        0,
        PANEL_WIDTH,
        Math.max(available.length * ROW_HEIGHT + 60, 100),
        0x111122,
        0.9
      )
      .setStrokeStyle(1, COLORS.station, 0.5)
      .setOrigin(0.5, 0);

    const title = this.scene.add
      .text(PANEL_WIDTH / 2, 10, "UPGRADES", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fff",
      })
      .setOrigin(0.5, 0);

    const panelContainer = this.scene.add.container(0, 0, [bg, title]);
    this.container.add(panelContainer);
    this.rows.push(panelContainer);

    // Group by category
    const byCategory = new Map<UpgradeCategory, UpgradeDefinition[]>();
    for (const def of available) {
      const list = byCategory.get(def.category) ?? [];
      list.push(def);
      byCategory.set(def.category, list);
    }

    let yOffset = 35;
    for (const [category, defs] of byCategory) {
      const catLabel = this.scene.add.text(
        10,
        yOffset,
        CATEGORY_LABELS[category],
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#888",
        }
      );
      const catContainer = this.scene.add.container(0, 0, [catLabel]);
      this.container.add(catContainer);
      this.rows.push(catContainer);
      yOffset += 18;

      for (const def of defs) {
        const row = this.createRow(def, tier, yOffset);
        this.container.add(row);
        this.rows.push(row);
        yOffset += ROW_HEIGHT;
      }
    }

    bg.height = yOffset + 10;
  }

  private createRow(
    def: UpgradeDefinition,
    tier: number,
    y: number
  ): Phaser.GameObjects.Container {
    const level = this.upgrades.getLevel(def.id);
    const cost = this.upgrades.getNextCost(def.id);
    const canBuy = this.upgrades.canPurchase(def.id, tier);

    const nameText = this.scene.add.text(
      10,
      y,
      `${def.name} (${level}/${def.maxLevel})`,
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: canBuy ? "#ccc" : "#666",
      }
    );

    const costColor = canBuy ? "#4ecdc4" : "#666";
    const buyBtn = this.scene.add
      .text(PANEL_WIDTH - 10, y, `${cost}m`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: costColor,
      })
      .setOrigin(1, 0);

    if (canBuy) {
      buyBtn.setInteractive({ useHandCursor: true });
      buyBtn.on("pointerdown", () => {
        this.upgrades.purchase(def.id, tier);
        this.rebuild();
      });
    }

    return this.scene.add.container(0, 0, [nameText, buyBtn]);
  }
}
