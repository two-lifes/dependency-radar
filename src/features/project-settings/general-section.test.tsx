import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeneralSection } from "./general-section";

const actions = vi.hoisted(() => ({
  renameProject:
    vi.fn<(id: string, name: string) => Promise<{ error?: string }>>(),
  replaceSource: vi.fn(),
}));
vi.mock("../projects/actions", () => actions);
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/ui/toast", () => toasts);

const nameField = () => screen.getByRole("textbox", { name: "Project name" });
const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("GeneralSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.renameProject.mockResolvedValue({});
  });

  it("keeps Save off until the name changes", () => {
    render(<GeneralSection projectId="p1" name="shop" />);
    expect(saveButton()).toBeDisabled();
    fireEvent.change(nameField(), { target: { value: "shop " } });
    expect(saveButton()).toBeDisabled();
    fireEvent.change(nameField(), { target: { value: "Shop web" } });
    expect(saveButton()).toBeEnabled();
  });

  it("renames the project and confirms with a toast", async () => {
    render(<GeneralSection projectId="p1" name="shop" />);
    fireEvent.change(nameField(), { target: { value: "Shop web" } });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith({ title: "Project renamed" }),
    );
    expect(actions.renameProject).toHaveBeenCalledWith("p1", "Shop web");
  });

  it("asks for a name before sending an empty one", async () => {
    render(<GeneralSection projectId="p1" name="shop" />);
    fireEvent.change(nameField(), { target: { value: "  " } });
    fireEvent.click(saveButton());
    expect(
      await screen.findByText("Enter a project name."),
    ).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(actions.renameProject).not.toHaveBeenCalled();
  });

  it("shows the server's answer under the field", async () => {
    actions.renameProject.mockResolvedValue({
      error: "Couldn't rename the project. Try again.",
    });
    render(<GeneralSection projectId="p1" name="shop" />);
    fireEvent.change(nameField(), { target: { value: "Shop web" } });
    fireEvent.click(saveButton());
    expect(
      await screen.findByText("Couldn't rename the project. Try again."),
    ).toBeInTheDocument();
    expect(toasts.toast).not.toHaveBeenCalled();
  });
});
