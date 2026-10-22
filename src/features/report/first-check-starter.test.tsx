import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstCheckStarter } from "./first-check-starter";

const actions = vi.hoisted(() => ({ checkAgain: vi.fn() }));
vi.mock("./actions", () => actions);

describe("FirstCheckStarter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts the first check once, even under StrictMode", async () => {
    actions.checkAgain.mockResolvedValue({});
    render(
      <StrictMode>
        <FirstCheckStarter reportId="r1" />
      </StrictMode>,
    );

    await waitFor(() => expect(actions.checkAgain).toHaveBeenCalledOnce());
    expect(actions.checkAgain).toHaveBeenCalledWith("r1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows why it couldn't start and tries again", async () => {
    actions.checkAgain.mockResolvedValueOnce({
      error: "Too many checks. Try again in 5 minutes.",
    });
    render(<FirstCheckStarter reportId="r1" />);

    expect(
      await screen.findByText("Too many checks. Try again in 5 minutes."),
    ).toBeInTheDocument();

    actions.checkAgain.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(actions.checkAgain).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});
