import { describe, expect, it } from "vitest";
import { summarizeIssueDom, summarizeScrollFrames } from "./scroll-performance";

describe("scroll performance summary", () => {
  it("summarizes dropped-frame intervals and long tasks without page contents", () => {
    expect(summarizeScrollFrames([16, 18, 60, 32], [75])).toEqual({
      frames: 4, slowFrames: 1, maxFrameMs: 60, p95FrameMs: 60,
      longTasks: 1, maxLongTaskMs: 75,
    });
  });
  it("counts the elements belonging to folded comment rows and action controls", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-comment-block><button data-reply-fold-id="x"><svg></svg></button><span data-comment-actions><button><svg></svg></button></span></div><div data-comment-block><div>open</div></div>';
    expect(summarizeIssueDom(root)).toEqual({
      renderedElements: 8, renderedCommentBlocks: 2, renderedCommentActions: 1,
      foldedCommentBlocks: 1, foldedCommentElements: 6, commentActionElements: 3,
    });
  });
});
