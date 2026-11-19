import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@multica/core/chat", () => ({ useChatStore: (select: (state: { floatingChatEnabled: boolean; setOpen: () => void }) => unknown) => select({ floatingChatEnabled: true, setOpen: vi.fn() }) }));
vi.mock("@multica/core/paths", () => ({ useWorkspacePaths: () => ({ chat: () => "/acme/chat" }) }));
vi.mock("../navigation", () => ({ useNavigation: () => ({ pathname: "/acme/chat" }) }));
vi.mock("./chat-dock-visibility", () => ({ useChatDockVisible: () => true }));
vi.mock("./components/chat-fab", () => ({ ChatFab: () => null }));
vi.mock("./components/chat-window", () => ({ ChatWindow: () => <div data-testid="floating-window" /> }));

import { FloatingChat } from "./floating-chat";

describe("desktop top chat", () => {
  it("does not mount a second chat window over the page or dock", () => {
    const { container } = render(<FloatingChat placement="top" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("preserves bottom bar suppression", () => {
    const { container } = render(<FloatingChat />);
    expect(container).toBeEmptyDOMElement();
  });
});
