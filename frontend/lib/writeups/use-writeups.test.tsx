// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/writeups", () => ({ listWriteups: vi.fn(async () => []) }));

import { listWriteups } from "@/lib/api/writeups";
import { useWriteups } from "./use-writeups";

function Reader() {
  const { state } = useWriteups();
  return <p>{state.status}</p>;
}

describe("useWriteups", () => {
  it("shares one list call across every component on the page", async () => {
    const { getAllByText } = render(
      <>
        <Reader />
        <Reader />
      </>,
    );
    await waitFor(() => expect(getAllByText("ok")).toHaveLength(2));
    expect(listWriteups).toHaveBeenCalledTimes(1);
  });
});
