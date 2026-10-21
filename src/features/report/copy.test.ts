import { describe, expect, it } from "vitest";
import { reportCopy } from "./copy";

const { commandCopiedWithMajors } = reportCopy.selection;

describe("commandCopiedWithMajors", () => {
  it.each([
    [["react"], "1 major update: react."],
    [["react", "next"], "2 major updates: react and next."],
    [["react", "next", "vue"], "3 major updates: react, next and 1 more."],
    [
      ["react", "next", "vue", "zod"],
      "4 major updates: react, next and 2 more.",
    ],
  ])("%j", (names, includes) => {
    expect(commandCopiedWithMajors(names)).toBe(
      `Update command copied. Includes ${includes} Check release notes before applying.`,
    );
  });
});
