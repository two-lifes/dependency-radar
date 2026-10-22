import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewProjectState } from "./new-project-state";
import { NewProjectForm } from "./new-project-form";

const actions = vi.hoisted(() => ({
  createProject:
    vi.fn<
      (state: NewProjectState, form: FormData) => Promise<NewProjectState>
    >(),
}));
vi.mock("./actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const nameField = () => screen.getByRole("textbox", { name: "Project name" });
const pasteField = () =>
  screen.getByRole("textbox", { name: "package.json contents" });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create & check" }));
// Radix Tabs switch on mousedown, not click.
const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
const sentForm = () => actions.createProject.mock.calls[0]?.[1];

describe("NewProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.createProject.mockImplementation(async (state) => state);
  });

  it("fills the name from the pasted package.json", () => {
    render(<NewProjectForm />);
    fireEvent.change(pasteField(), {
      target: { value: '{"name":"shop-frontend","dependencies":{}}' },
    });
    expect(nameField()).toHaveValue("shop-frontend");
  });

  it("keeps a name typed by hand", () => {
    render(<NewProjectForm />);
    fireEvent.change(nameField(), { target: { value: "My shop" } });
    fireEvent.change(pasteField(), {
      target: { value: '{"name":"shop-frontend"}' },
    });
    expect(nameField()).toHaveValue("My shop");
  });

  it("asks for a name before sending pasted package.json", async () => {
    render(<NewProjectForm />);
    fireEvent.change(pasteField(), {
      target: { value: '{"dependencies":{}}' },
    });
    submit();

    expect(
      await screen.findByText("Enter a project name."),
    ).toBeInTheDocument();
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(actions.createProject).not.toHaveBeenCalled();
  });

  it("sends a repository without a name for the server to fill in", async () => {
    render(<NewProjectForm />);
    openTab("GitHub URL");
    expect(
      screen.getByText("Leave empty to use the name from package.json."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Repository URL" }), {
      target: { value: "https://github.com/acme/web" },
    });
    submit();

    await waitFor(() => expect(actions.createProject).toHaveBeenCalledOnce());
    expect(sentForm()?.get("source")).toBe("github");
    expect(sentForm()?.get("name")).toBe("");
    expect(sentForm()?.get("url")).toBe("https://github.com/acme/web");
  });

  it("shows a server error under its field and focuses it", async () => {
    actions.createProject.mockImplementationOnce(async (state) => ({
      attempt: state.attempt + 1,
      error: { field: "paste", message: "No dependencies found in this file." },
    }));
    render(<NewProjectForm />);
    fireEvent.change(nameField(), { target: { value: "shop" } });
    fireEvent.change(pasteField(), { target: { value: "{}" } });
    submit();

    expect(
      await screen.findByText("No dependencies found in this file."),
    ).toBeInTheDocument();
    expect(pasteField()).toHaveFocus();
  });

  it("asks before leaving a filled form and leaves on Discard", async () => {
    render(<NewProjectForm />);
    fireEvent.change(nameField(), { target: { value: "shop" } });
    fireEvent.click(screen.getByRole("link", { name: "Cancel" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Discard changes?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(router.push).toHaveBeenCalledWith("/projects");
  });

  it("leaves an untouched form without asking", () => {
    render(<NewProjectForm />);
    const cancel = screen.getByRole("link", { name: "Cancel" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    // jsdom doesn't navigate; a prevented default would mean the guard ran.
    cancel.addEventListener("click", (event) => event.preventDefault());
    cancel.dispatchEvent(click);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
