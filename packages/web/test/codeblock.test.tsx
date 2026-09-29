// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodeBlock } from "../src/components/CodeBlock.js";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CodeBlock", () => {
  it("renders one gutter number per code line", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <CodeBlock language="js" code={"a\nb\nc"}>
          <code>a{"\n"}b{"\n"}c</code>
        </CodeBlock>,
      );
    });

    const numbers = [...container.querySelectorAll(".code-gutter span")].map((el) => el.textContent);
    expect(numbers).toEqual(["1", "2", "3"]);

    await act(async () => root.unmount());
  });

  it("still renders a single line number for empty code", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <CodeBlock language="" code="">
          <code />
        </CodeBlock>,
      );
    });

    expect(container.querySelectorAll(".code-gutter span").length).toBe(1);

    await act(async () => root.unmount());
  });
});
