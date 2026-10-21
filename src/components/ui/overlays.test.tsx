import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";
import { Skeleton } from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

describe("Dialog", () => {
  it("is a labelled modal that closes on Escape and returns focus", async () => {
    render(
      <Dialog>
        <DialogTrigger>Delete project</DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Delete project" });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Delete project?",
    });
    expect(dialog).toHaveAccessibleDescription("This can't be undone.");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});

describe("Tabs", () => {
  it("exposes tab roles and moves between tabs with arrow keys", async () => {
    render(
      <Tabs defaultValue="vulns">
        <TabsList aria-label="Package details">
          <TabsTrigger value="vulns">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="notes">Release notes</TabsTrigger>
        </TabsList>
        <TabsContent value="vulns">Vulns panel</TabsContent>
        <TabsContent value="notes">Notes panel</TabsContent>
      </Tabs>,
    );
    expect(
      screen.getByRole("tablist", { name: "Package details" }),
    ).toBeInTheDocument();
    const first = screen.getByRole("tab", { name: "Vulnerabilities" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Vulns panel");

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Release notes" });
    await waitFor(() =>
      expect(second).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Notes panel");
  });

  // Chrome draws the keyboard focus ring for script focus, which Radix uses
  // on mousedown; jsdom has no :focus-visible, so the call itself is checked.
  it("focuses a clicked tab without the keyboard focus ring", () => {
    const onMouseDown = vi.fn();
    render(
      <Tabs defaultValue="vulns">
        <TabsList>
          <TabsTrigger value="vulns">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="notes" onMouseDown={onMouseDown}>
            Release notes
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const second = screen.getByRole("tab", { name: "Release notes" });
    const focus = vi.spyOn(second, "focus");

    fireEvent.mouseDown(second, { button: 0 });

    expect(focus).toHaveBeenNthCalledWith(1, { focusVisible: false });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(onMouseDown).toHaveBeenCalledOnce();
  });
});

describe("Tooltip", () => {
  it("opens on keyboard focus", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>3 days ago</TooltipTrigger>
          <TooltipContent>Oct 16, 2026, 14:02</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "3 days ago" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Oct 16, 2026, 14:02",
    );
  });
});

describe("Popover", () => {
  it("toggles aria-expanded and shows its content", async () => {
    render(
      <Popover>
        <PopoverTrigger>How it&apos;s calculated</PopoverTrigger>
        <PopoverContent>Weights</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "How it's calculated" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Weights");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DropdownMenu", () => {
  it("opens from the keyboard and exposes menu items", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Project actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Project actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass(
      "text-danger",
    );
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveClass("animate-skeleton", "bg-muted");
  });
});

describe("Sheet", () => {
  it("is a labelled modal that closes on Escape and returns focus", async () => {
    render(
      <Sheet>
        <SheetTrigger>Filters</SheetTrigger>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Filter packages</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const trigger = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(trigger);

    const sheet = await screen.findByRole("dialog", {
      name: "Filter packages",
    });
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});

describe("Checkbox", () => {
  it("toggles and reports a mixed state", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Checkbox
        aria-label="Select react"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "Select react" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(<Checkbox aria-label="Select react" checked="indeterminate" />);
    expect(box).toHaveAttribute("aria-checked", "mixed");
  });
});
