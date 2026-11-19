import { describe, expect, it } from "vitest";
import { chooseToolbarFit, toolbarWidth, TOOL_SIZE, type ToolItem } from "../src/ui/toolbarFit";

const measure = (t: string) => t.length * 8;
const items: ToolItem[] = [
  { label: "Search", overflow: false },
  { label: "Home", overflow: false },
  { label: "Views", overflow: false },
  { label: "Labels", overflow: true },
  { label: "Colour", overflow: true },
  { label: "Screenshot", overflow: true },
  { label: "Share", overflow: true },
  { label: "Settings", overflow: true },
];

describe("toolbar fit", () => {
  it("measures each layout", () => {
    expect(toolbarWidth(items, "icons", measure)).toBe(8 * 44 + 7 * 4 + TOOL_SIZE.frame);
    expect(toolbarWidth(items, "more", measure)).toBe(4 * 44 + 3 * 4 + TOOL_SIZE.frame);
    expect(toolbarWidth(items, "labels", measure)).toBeGreaterThan(toolbarWidth(items, "icons", measure));
  });

  it("picks labels, then icons, then More as the room shrinks", () => {
    const labels = toolbarWidth(items, "labels", measure) + 2 * TOOL_SIZE.margin;
    const icons = toolbarWidth(items, "icons", measure) + 2 * TOOL_SIZE.margin;
    expect(chooseToolbarFit(items, labels, 1400, measure)).toBe("labels");
    expect(chooseToolbarFit(items, labels - 1, 1400, measure)).toBe("icons");
    expect(chooseToolbarFit(items, icons, 1400, measure)).toBe("icons");
    expect(chooseToolbarFit(items, icons - 1, 1400, measure)).toBe("more");
  });

  it("always uses More on a phone, and never when nothing can overflow", () => {
    expect(chooseToolbarFit(items, 2000, 390, measure)).toBe("more");
    const core = items.filter((i) => !i.overflow);
    expect(chooseToolbarFit(core, 100, 390, measure)).toBe("icons");
    expect(chooseToolbarFit(core, 100, 1400, measure)).toBe("icons");
  });
});
