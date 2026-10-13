import { describe, it, expect, vi, afterEach } from "vitest";
import { withLoadTimeout } from "./load-timeout";
afterEach(() => vi.useRealTimers());
describe("bounded data loads", () => {
  it("fails a stalled request instead of spinning forever", async () => {
    vi.useFakeTimers();
    const pending = withLoadTimeout(new Promise(() => {}));
    const check = expect(pending).rejects.toThrow("তথ্য আনতে সময় বেশি লাগছে");
    await vi.advanceTimersByTimeAsync(20_000);
    await check;
  });
  it("returns successful data and clears timer", async () => {
    vi.useFakeTimers();
    await expect(withLoadTimeout(Promise.resolve(["case"]))).resolves.toEqual([
      "case",
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves permission errors", async () => {
    await expect(
      withLoadTimeout(Promise.reject(new Error("permission-denied"))),
    ).rejects.toThrow("permission-denied");
  });
});
