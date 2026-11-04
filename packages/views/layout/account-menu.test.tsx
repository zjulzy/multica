import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@multica/ui/components/ui/tooltip";
import { renderWithI18n } from "../test/i18n";
import { AccountMenu } from "./account-menu";

const state = vi.hoisted(() => ({ theme: "sakura-blush", themes: ["light", "dark", "system", "sakura-blush", "deep-ocean"], setTheme: vi.fn() }));
vi.mock("@multica/ui/components/common/theme-provider", () => ({ useTheme: () => state }));
vi.mock("@multica/core/auth", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { name: "Test", email: "test@example.com" } }) }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ settings: () => "/settings" }) }));
vi.mock("../auth", () => ({ useLogout: () => vi.fn() }));
vi.mock("../common/use-language-switch", () => ({ useLanguageSwitch: () => ({ options: [], currentLocale: "en", changeLanguage: vi.fn() }) }));
vi.mock("../navigation", () => ({ AppLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("../platform/local-directory", () => ({ isDesktopShell: () => true }));
vi.mock("@multica/ui/components/common/actor-avatar", () => ({ ActorAvatar: () => <span>Avatar</span> }));
vi.mock("@multica/core/workspace/avatar-url", () => ({ resolvePublicFileUrl: () => null }));
vi.mock("@multica/ui/components/ui/dropdown-menu", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Container, DropdownMenuContent: Container, DropdownMenuGroup: Container,
    DropdownMenuSub: Container, DropdownMenuSubContent: Container, DropdownMenuSubTrigger: Container,
    DropdownMenuSeparator: () => null,
    DropdownMenuItem: Container,
    DropdownMenuTrigger: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => <button {...props}>{children}</button>,
    DropdownMenuRadioGroup: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) =>
      <div data-value={value} onChange={(event) => onValueChange((event.target as HTMLInputElement).value)}>{children}</div>,
    DropdownMenuRadioItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
      <label><input type="radio" role="menuitemradio" value={value} name="theme-test" />{children}</label>,
  };
});

beforeEach(() => { state.setTheme.mockReset(); state.theme = "sakura-blush"; state.themes = ["light", "dark", "system", "sakura-blush", "deep-ocean"]; });

describe("account theme menu", () => {
  it("shows the selected custom theme and switches to an available custom theme", async () => {
    renderWithI18n(<TooltipProvider><AccountMenu /></TooltipProvider>);
    expect(screen.getAllByText("Sakura Blush")).toHaveLength(2);
    const item = screen.getByRole("menuitemradio", { name: "Deep Ocean" });
    fireEvent.click(item);
    expect(state.setTheme).toHaveBeenCalledWith("deep-ocean");
    expect(screen.queryByRole("menuitemradio", { name: "Graphite Copper" })).toBeNull();
  });
});
