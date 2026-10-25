vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReplaceSourceState } from "./replace-source-state";
import { SourceSection } from "./source-section";

const actions = vi.hoisted(() => ({
  replaceSource:
    vi.fn<
      (
        projectId: string,
        state: ReplaceSourceState,
        form: FormData,
      ) => Promise<ReplaceSourceState>
    >(),
  renameProject: vi.fn(),
}));
vi.mock("../projects/actions", () => actions);

const MANIFEST = '{"dependencies":{"react":"^19.0.0"}}';

function renderSection() {
  render(
    <SourceSection
      projectId="p1"
      source="github"
      repoUrl="https://github.com/acme/shop"
    />,
  );
}

const openForm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Replace source" }));
const paste = (value: string) =>
  fireEvent.change(
    screen.getByRole("textbox", { name: "package.json contents" }),
    { target: { value } },
  );
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("SourceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.replaceSource.mockImplementation(async (_id, state) => ({
      attempt: state.attempt + 1,
    }));
  });

  it("shows the current repository", () => {
    renderSection();
    expect(
      screen.getByRole("link", { name: "github.com/acme/shop" }),
    ).toHaveAttribute("href", "https://github.com/acme/shop");
  });

  it("asks before replacing, then sends the new source", async () => {
    renderSection();
    openForm();
    paste(MANIFEST);
    save();

    const dialog = await screen.findByRole("dialog", {
      name: "Replace source?",
    });
    expect(dialog).toHaveTextContent(
      "This will run a new check. History is kept.",
    );
    expect(actions.replaceSource).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Replace & check" }));
    await waitFor(() => expect(actions.replaceSource).toHaveBeenCalled());
    const sent = actions.replaceSource.mock.calls[0]?.[2];
    expect(actions.replaceSource.mock.calls[0]?.[0]).toBe("p1");
    expect(sent?.get("source")).toBe("paste");
    expect(sent?.get("packageJson")).toBe(MANIFEST);
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderSection();
    openForm();
    paste(MANIFEST);
    save();
    // While the dialog is open the form behind it is hidden, so this is the
    // dialog's Cancel.
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(actions.replaceSource).not.toHaveBeenCalled();
  });

  it("flags an empty paste without asking", async () => {
    renderSection();
    openForm();
    save();
    expect(
      await screen.findByText("Paste your package.json first."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a server error under the source field", async () => {
    actions.replaceSource.mockImplementation(async (_id, state) => ({
      attempt: state.attempt + 1,
      error: {
        field: "paste",
        message: "Too many checks. Try again in 5 minutes.",
      },
    }));
    renderSection();
    openForm();
    paste(MANIFEST);
    save();
    fireEvent.click(
      await screen.findByRole("button", { name: "Replace & check" }),
    );
    expect(
      await screen.findByText("Too many checks. Try again in 5 minutes."),
    ).toBeInTheDocument();
  });

  it("closes the form on Cancel and returns focus to Replace source", async () => {
    renderSection();
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const replace = screen.getByRole("button", { name: "Replace source" });
    await waitFor(() => expect(replace).toHaveFocus());
    expect(
      screen.queryByRole("textbox", { name: "package.json contents" }),
    ).not.toBeInTheDocument();
  });
});

it("allows editing but blocks replacement during the server cooldown", () => {
  render(
    <SourceSection
      projectId="p1"
      source="paste"
      repoUrl={null}
      nextCheckAt={new Date(Date.now() + 60_000).toISOString()}
    />,
  );
  openForm();
  paste(MANIFEST);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(/Try again in \d+s\./);
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});
