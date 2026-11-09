import { afterEach, describe, expect, it, vi } from "vitest";
import { fadeReplyIn, fadeReplyOut } from "./reply-fold-motion";

afterEach(() => {
  delete document.documentElement.dataset.interfaceMotion;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reply fold motion", () => {
  it("commits immediately when the interface motion setting is off", () => {
    document.documentElement.dataset.interfaceMotion = "off";
    const element = document.createElement("div");
    const commit = vi.fn();
    fadeReplyOut(element, commit);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("animates the reply body height to zero before committing", async () => {
    document.documentElement.dataset.interfaceMotion = "on";
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    let nextFrame!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ height: 300 } as DOMRect);
    let finish!: () => void;
    const animation = { finished: new Promise<void>((resolve) => { finish = resolve; }), cancel: vi.fn() };
    element.animate = vi.fn(() => animation as unknown as Animation);
    const commit = vi.fn();
    fadeReplyOut(element, commit);
    expect(element.animate).not.toHaveBeenCalled();
    nextFrame(0);
    expect(element.animate).toHaveBeenCalledOnce();
    expect(element.animate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ height: "300px" }), expect.objectContaining({ height: "0px" })]), expect.objectContaining({ fill: "forwards" }));
    expect(commit).not.toHaveBeenCalled();
    finish();
    await animation.finished;
    expect(commit).toHaveBeenCalledOnce();
  });

  it("never animates when the system requests reduced motion", () => {
    document.documentElement.dataset.interfaceMotion = "on";
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const element = document.createElement("div");
    element.animate = vi.fn();
    const commit = vi.fn();
    fadeReplyIn(element);
    fadeReplyOut(element, commit);
    expect(element.animate).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledOnce();
  });

  it("opens from zero height and restores natural sizing after animation", async () => {
    document.documentElement.dataset.interfaceMotion = "on";
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    let nextFrame!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
    const element = document.createElement("div");
    document.body.append(element);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ height: 300 } as DOMRect);
    let finish!: () => void;
    const animation = { finished: new Promise<void>((resolve) => { finish = resolve; }), cancel: vi.fn() };
    element.animate = vi.fn(() => animation as unknown as Animation);
    fadeReplyIn(element);
    expect(element.style.height).toBe("0px");
    nextFrame(0);
    expect(element.animate).toHaveBeenCalledWith([{ height: "0px" }, { height: "300px" }], expect.any(Object));
    finish();
    await animation.finished;
    expect(element.style.height).toBe("");
    expect(element.style.overflow).toBe("");
    element.remove();
  });

  it("finishes collapsing if virtualization cancels the animation", async () => {
    document.documentElement.dataset.interfaceMotion = "on";
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    let nextFrame!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
    const element = document.createElement("div");
    let reject!: (reason: Error) => void;
    const finished = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    element.animate = vi.fn(() => ({ finished, cancel: vi.fn() }) as unknown as Animation);
    const commit = vi.fn();
    fadeReplyOut(element, commit);
    nextFrame(0);
    reject(new Error("animation cancelled"));
    await finished.catch(() => {});
    expect(commit).toHaveBeenCalledOnce();
  });
});
