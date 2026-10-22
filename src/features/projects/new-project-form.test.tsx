import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "@/server/analysis/result";
import type { SourceError } from "@/server/sources/http";
import type { GithubRepoList } from "./github-repos";
import type { NewProjectState } from "./new-project-state";
import { NewProjectForm } from "./new-project-form";

const actions = vi.hoisted(() => ({
  createProject:
    vi.fn<
      (state: NewProjectState, form: FormData) => Promise<NewProjectState>
    >(),
  loadGithubRepos: vi.fn<() => Promise<Result<GithubRepoList, SourceError>>>(),
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

describe("NewProjectForm repository list", () => {
  const urlField = () =>
    screen.getByRole("textbox", { name: "Repository URL" });
  const repoButton = (name: RegExp) => screen.getByRole("button", { name });

  const list: GithubRepoList = {
    login: "octocat",
    repos: [
      {
        name: "shop",
        fullName: "octocat/shop",
        url: "https://github.com/octocat/shop",
        description: "Storefront",
        language: "TypeScript",
        pushedAt: "2026-10-19T10:00:00Z",
      },
      {
        name: "blog",
        fullName: "octocat/blog",
        url: "https://github.com/octocat/blog",
        projectId: "p-blog",
      },
    ],
  };

  const renderConnected = () =>
    render(<NewProjectForm initialSource="github" githubConnected />);

  beforeEach(() => {
    vi.clearAllMocks();
    actions.createProject.mockImplementation(async (state) => state);
    actions.loadGithubRepos.mockResolvedValue({ ok: true, value: list });
  });

  it("opens on the GitHub tab with ?source=github", () => {
    render(<NewProjectForm initialSource="github" />);
    expect(screen.getByRole("tab", { name: "GitHub URL" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(urlField()).toBeInTheDocument();
  });

  it("links to the profile when GitHub isn't connected", () => {
    render(<NewProjectForm initialSource="github" />);
    expect(
      screen.getByRole("link", {
        name: "Connect GitHub to see your repositories",
      }),
    ).toHaveAttribute("href", "/settings/profile");
    expect(actions.loadGithubRepos).not.toHaveBeenCalled();
  });

  it("loads only once the GitHub tab is opened, and once", async () => {
    render(<NewProjectForm githubConnected />);
    expect(actions.loadGithubRepos).not.toHaveBeenCalled();

    openTab("GitHub URL");
    expect(screen.getByLabelText("Loading your repositories")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      await screen.findByText("Your public repositories (@octocat)"),
    ).toBeInTheDocument();

    openTab("Paste");
    openTab("GitHub URL");
    expect(repoButton(/octocat\/shop/)).toBeInTheDocument();
    expect(actions.loadGithubRepos).toHaveBeenCalledOnce();
  });

  it("fills the URL and the name from the picked repository", async () => {
    renderConnected();
    fireEvent.click(
      await screen.findByRole("button", { name: /octocat\/shop/ }),
    );

    expect(urlField()).toHaveValue("https://github.com/octocat/shop");
    expect(nameField()).toHaveValue("shop");
    expect(repoButton(/octocat\/shop/)).toHaveAttribute("aria-pressed", "true");

    submit();
    await waitFor(() => expect(actions.createProject).toHaveBeenCalledOnce());
    expect(sentForm()?.get("url")).toBe("https://github.com/octocat/shop");
    expect(sentForm()?.get("name")).toBe("shop");
  });

  it("keeps a name typed by hand", async () => {
    renderConnected();
    fireEvent.change(nameField(), { target: { value: "My shop" } });
    fireEvent.click(
      await screen.findByRole("button", { name: /octocat\/shop/ }),
    );

    expect(nameField()).toHaveValue("My shop");
    expect(urlField()).toHaveValue("https://github.com/octocat/shop");
  });

  it("drops the selection when the URL is typed by hand", async () => {
    renderConnected();
    fireEvent.click(
      await screen.findByRole("button", { name: /octocat\/shop/ }),
    );
    fireEvent.change(urlField(), {
      target: { value: "https://github.com/acme/web" },
    });

    expect(repoButton(/octocat\/shop/)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows an added repository as a link to its project, not a choice", async () => {
    renderConnected();
    const link = await screen.findByRole("link", { name: "octocat/blog" });

    expect(link).toHaveAttribute("href", "/projects/p-blog/dependencies");
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /octocat\/blog/ }),
    ).not.toBeInTheDocument();
  });

  it("searches by name and says when nothing matches", async () => {
    renderConnected();
    const search = await screen.findByRole("searchbox", {
      name: "Search repositories…",
    });

    fireEvent.change(search, { target: { value: "BLOG" } });
    expect(
      screen.queryByRole("button", { name: /octocat\/shop/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "octocat/blog" }),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "api" } });
    expect(
      screen.getByText('No repositories match "api".'),
    ).toBeInTheDocument();
  });

  it("doesn't submit the form on Enter in the search", async () => {
    renderConnected();
    const search = await screen.findByRole("searchbox", {
      name: "Search repositories…",
    });
    fireEvent.change(search, { target: { value: "shop" } });
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(enter);

    // A default action left in place is what submits the form in a browser.
    expect(enter.defaultPrevented).toBe(true);
    expect(actions.createProject).not.toHaveBeenCalled();
  });

  it("says when the user has no public repositories", async () => {
    actions.loadGithubRepos.mockResolvedValue({
      ok: true,
      value: { login: "octocat", repos: [] },
    });
    renderConnected();

    expect(
      await screen.findByText("No public repositories on @octocat."),
    ).toBeInTheDocument();
  });

  it("retries a failed load and keeps the URL field usable", async () => {
    actions.loadGithubRepos.mockResolvedValueOnce({
      ok: false,
      error: { code: "unavailable" },
    });
    renderConnected();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your repositories.",
    );
    expect(urlField()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("button", { name: /octocat\/shop/ }),
    ).toBeInTheDocument();
    expect(actions.loadGithubRepos).toHaveBeenCalledTimes(2);
  });

  it("treats a failed action call like a failed load", async () => {
    actions.loadGithubRepos.mockRejectedValueOnce(new Error("offline"));
    renderConnected();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your repositories.",
    );
  });

  it("shows the GitHub rate limit", async () => {
    actions.loadGithubRepos.mockResolvedValue({
      ok: false,
      error: { code: "rate-limited", retryAfterSeconds: 300 },
    });
    renderConnected();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub is rate-limiting us. Try again in 5 minutes.",
    );
  });
});
