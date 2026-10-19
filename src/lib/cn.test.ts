import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins conditional classes", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("treats custom font sizes as font sizes, not colors", () => {
    expect(cn("text-sm text-hero")).toBe("text-hero");
    expect(cn("text-md text-2xs")).toBe("text-2xs");
    expect(cn("text-foreground text-md")).toBe("text-foreground text-md");
  });

  it("treats shadow-overlay as a shadow size", () => {
    expect(cn("shadow-sm shadow-overlay")).toBe("shadow-overlay");
  });

  it("lets a later class override a conflicting one", () => {
    expect(cn("h-9 px-4", "h-8")).toBe("px-4 h-8");
  });
});
