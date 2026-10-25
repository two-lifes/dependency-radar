import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DangerZone } from "./danger-zone";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../projects/actions", () => ({ removeProject: vi.fn() }));

const project = { id: "p1", name: "shop-frontend" };

describe("DangerZone", () => {
  it("opens the delete dialog", async () => {
    render(<DangerZone project={project} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it.each(["Escape", "Cancel"])(
    "returns focus to Delete project after %s",
    async (action) => {
      render(<DangerZone project={project} />);
      const trigger = screen.getByRole("button", { name: "Delete project" });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog");
      if (action === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
      else
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("disables deleting in the demo and says why", () => {
    render(<DangerZone project={project} demo />);
    const button = screen.getByRole("button", { name: "Delete project" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Not available in the demo.");
  });
});
