import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyProjects } from "./empty-projects";
import { ProjectsLayout } from "./projects-layout";

const importLink = () =>
  screen.queryByRole("link", { name: "Import from GitHub" });
const connectLink = () =>
  screen.queryByRole("link", {
    name: "Connect GitHub to see your repositories",
  });

describe("EmptyProjects", () => {
  it("leads with Import from GitHub when GitHub is connected", () => {
    render(<EmptyProjects githubConnected />);
    expect(importLink()).toHaveAttribute("href", "/projects/new?source=github");
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(connectLink()).not.toBeInTheDocument();
  });

  it("offers to connect GitHub otherwise", () => {
    render(<EmptyProjects />);
    expect(importLink()).not.toBeInTheDocument();
    expect(connectLink()).toHaveAttribute("href", "/settings/profile");
    expect(
      screen.getByRole("link", { name: "New project" }),
    ).toBeInTheDocument();
  });
});

describe("ProjectsLayout", () => {
  it("shows Import from GitHub only with GitHub connected", () => {
    const { rerender } = render(
      <ProjectsLayout githubConnected>content</ProjectsLayout>,
    );
    expect(importLink()).toHaveAttribute("href", "/projects/new?source=github");

    rerender(<ProjectsLayout>content</ProjectsLayout>);
    expect(importLink()).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New project" }),
    ).toBeInTheDocument();
  });

  it("leaves the actions to the empty state when asked", () => {
    render(
      <ProjectsLayout githubConnected actions={false}>
        content
      </ProjectsLayout>,
    );
    expect(
      screen.getByRole("heading", { name: "Projects" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
