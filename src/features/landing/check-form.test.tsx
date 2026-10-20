import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckForm } from "./check-form";
import type { CheckFormAction, CheckFormState } from "./check-form-state";
import { SAMPLE_PACKAGE_JSON } from "./sample-package-json";

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Check dependencies" }));

// Radix Tabs switch on mousedown, not click.
const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

describe("CheckForm", () => {
  it("fills the paste field with the sample project", () => {
    render(<CheckForm action={vi.fn()} />);
    openTab("GitHub URL");

    fireEvent.click(
      screen.getByRole("button", { name: "or try a sample project" }),
    );

    expect(screen.getByRole("tab", { name: "Paste" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("textbox", { name: "package.json contents" }),
    ).toHaveValue(SAMPLE_PACKAGE_JSON);
  });

  it("sends the pasted text and source", async () => {
    const action = vi.fn<CheckFormAction>(async (state) => state);
    render(<CheckForm action={action} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "package.json contents" }),
      { target: { value: '{"dependencies":{"a":"1.0.0"}}' } },
    );
    submit();

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("source")).toBe("paste");
    expect(formData?.get("packageJson")).toBe('{"dependencies":{"a":"1.0.0"}}');
  });

  it("shows a server error under the field and focuses it", async () => {
    const action = vi.fn<CheckFormAction>(
      async (state): Promise<CheckFormState> => ({
        attempt: state.attempt + 1,
        error: {
          source: "paste",
          message: "No dependencies found in this file.",
        },
      }),
    );
    render(<CheckForm action={action} />);
    const field = screen.getByRole("textbox", {
      name: "package.json contents",
    });
    fireEvent.change(field, { target: { value: "{}" } });

    submit();

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("No dependencies found in this file.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "No dependencies found in this file.",
    );
    await waitFor(() => expect(field).toHaveFocus());
    // The pasted text survives the failed attempt.
    expect(field).toHaveValue("{}");

    // Editing the field dismisses the error it was about.
    fireEvent.change(field, { target: { value: '{"dependencies":{}}' } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("shows Starting… and disables the button while submitting", async () => {
    let finish: (state: CheckFormState) => void = () => {};
    const action = vi.fn<CheckFormAction>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<CheckForm action={action} />);

    submit();

    const button = await screen.findByRole("button", { name: "Starting…" });
    expect(button).toBeDisabled();
    finish({ attempt: 1 });
    expect(
      await screen.findByRole("button", { name: "Check dependencies" }),
    ).toBeEnabled();
  });

  it("does not send an upload without package.json", async () => {
    const action = vi.fn<CheckFormAction>(async (state) => state);
    render(<CheckForm action={action} />);
    openTab("Upload file");

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add a package.json file.",
    );
    expect(screen.getByRole("button", { name: "browse" })).toHaveFocus();
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects a dropped yarn lockfile", async () => {
    render(<CheckForm action={vi.fn()} />);
    openTab("Upload file");

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input not rendered");
    fireEvent.change(input, {
      target: {
        files: [new File(["# yarn lockfile v1\n"], "yarn.lock")],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This is a lockfile. Paste package.json instead.",
    );
  });
});
