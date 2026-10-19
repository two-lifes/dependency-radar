import { describe, expect, it } from "vitest";
import { updateCommands, type UpdateTarget } from "./update-command";

const react: UpdateTarget = {
  name: "react",
  registryName: "react",
  version: "19.1.0",
  type: "prod",
};
const reactDom: UpdateTarget = {
  ...react,
  name: "react-dom",
  registryName: "react-dom",
};
const vitest: UpdateTarget = {
  name: "vitest",
  registryName: "vitest",
  version: "3.2.4",
  type: "dev",
};

describe("updateCommands", () => {
  it.each([
    ["npm", ["npm i react@19.1.0 react-dom@19.1.0", "npm i -D vitest@3.2.4"]],
    [
      "pnpm",
      ["pnpm add react@19.1.0 react-dom@19.1.0", "pnpm add -D vitest@3.2.4"],
    ],
    [
      "yarn",
      ["yarn add react@19.1.0 react-dom@19.1.0", "yarn add -D vitest@3.2.4"],
    ],
  ] as const)(
    "builds separate prod and dev commands for %s",
    (manager, expected) => {
      expect(updateCommands(manager, [react, vitest, reactDom])).toEqual(
        expected,
      );
    },
  );

  it("omits an empty group", () => {
    expect(updateCommands("npm", [vitest])).toEqual(["npm i -D vitest@3.2.4"]);
    expect(updateCommands("pnpm", [react])).toEqual(["pnpm add react@19.1.0"]);
  });

  it("keeps npm: aliases", () => {
    expect(updateCommands("pnpm", [{ ...react, name: "react19" }])).toEqual([
      "pnpm add react19@npm:react@19.1.0",
    ]);
  });

  it("lists each package once", () => {
    expect(updateCommands("npm", [react, react])).toEqual([
      "npm i react@19.1.0",
    ]);
  });

  it("returns nothing for an empty selection", () => {
    expect(updateCommands("yarn", [])).toEqual([]);
  });
});
