import { renderWithI18n } from "../../test/i18n";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionList } from "./collection-list";

const mock = vi.hoisted(() => ({ desktop: true, estimate: null as null | ((index: number) => number) }));
vi.mock("../../platform/local-directory", () => ({ isDesktopShell: () => mock.desktop }));
vi.mock("../../navigation", () => ({ useRowLink: () => () => null, useIntentNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { estimateSize: (index: number) => number }) => {
    mock.estimate = options.estimateSize;
    return { getVirtualItems: () => [], getTotalSize: () => 0, scrollToIndex: vi.fn() };
  },
}));

describe("desktop collection density", () => {
  it("renders roomier rows and uses the same size for virtualization", () => {
    mock.desktop = true;
    renderWithI18n(<CollectionList label="Agents" columns={[{ key: "name", header: "Name", cell: (row: string) => row }]} rows={["Agent"]} getRowId={(row) => row} comfortableOnDesktop />);
    expect(screen.getByText("Agent").closest('[role="row"]')).toHaveClass("h-10");
    expect(screen.getByRole("grid")).toHaveStyle({ "--text-body": "15px" });
    expect(mock.estimate?.(0)).toBe(40);
  });

  it("keeps the default density outside the desktop client", () => {
    mock.desktop = false;
    renderWithI18n(<CollectionList label="Agents" columns={[{ key: "name", header: "Name", cell: (row: string) => row }]} rows={["Agent"]} getRowId={(row) => row} comfortableOnDesktop />);
    expect(screen.getByText("Agent").closest('[role="row"]')).toHaveClass("h-9");
    expect(mock.estimate?.(0)).toBe(36);
  });
});
