import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteProjectDialog } from "./delete-project-dialog";

const actions = vi.hoisted(() => ({ removeProject: vi.fn() }));
vi.mock("./actions", () => actions);
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/ui/toast", () => toasts);

const project = { id: "p1", name: "shop-frontend" };

function renderDialog() {
  const onDeleted = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DeleteProjectDialog
      project={project}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  );
  return { onDeleted, onOpenChange };
}

const confirmButton = () =>
  screen.getByRole("button", { name: "Delete project" });
const typeName = (value: string) =>
  fireEvent.change(
    screen.getByRole("textbox", { name: "Type shop-frontend to confirm" }),
    { target: { value } },
  );

describe("DeleteProjectDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes only once the project name is typed in", async () => {
    actions.removeProject.mockResolvedValue({ ok: true });
    const { onDeleted, onOpenChange } = renderDialog();

    expect(confirmButton()).toBeDisabled();
    typeName("shop");
    expect(confirmButton()).toBeDisabled();
    typeName("shop-frontend");
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("p1"));
    expect(actions.removeProject).toHaveBeenCalledWith("p1");
    expect(toasts.toast).toHaveBeenCalledWith({ title: "Project deleted" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open with an error toast when deleting fails", async () => {
    actions.removeProject.mockResolvedValue({ ok: false });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onDeleted } = renderDialog();

    typeName("shop-frontend");
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith({
        title: "Couldn't delete the project. Try again.",
      }),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
