import { describe, it, expect } from "vitest";
import {
  caseFormSchema,
  clientFormSchema,
  date,
  toCsv,
  canEdit,
  canManage,
  validateFile,
} from "./schema";
describe("validation and permissions", () => {
  it("rejects rollover dates and accepts leap days", () => {
    expect(date.safeParse("2026-02-30").success).toBe(false);
    expect(date.safeParse("2024-02-29").success).toBe(true);
  });
  it("requires Bangladesh client phone but no email", () => {
    expect(
      clientFormSchema.safeParse({
        full_name: "রহিম",
        phone: "01712345678",
        alternative_phone: "",
        address: "",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      clientFormSchema.safeParse({
        full_name: "রহিম",
        phone: "123",
        alternative_phone: "",
        address: "",
        notes: "",
      }).success,
    ).toBe(false);
  });
  it("validates case ownership reference and official number", () => {
    expect(caseFormSchema.safeParse({ title: "Test" }).success).toBe(false);
  });
  it("keeps viewers read-only and management restricted", () => {
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit("assistant")).toBe(true);
    expect(canManage("lawyer")).toBe(false);
    expect(canManage("owner")).toBe(true);
  });
  it("escapes CSV commas, quotes and spreadsheet formula injection", () => {
    expect(toCsv([["a,b", '"test"', '=IMPORTXML("url")']])).toContain(
      '"a,b","""test""","\'=IMPORTXML(""url"")"',
    );
  });
  it("checks file signatures instead of trusting extensions", async () => {
    await expect(
      validateFile(
        new File(["not a PDF"], "bad.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toThrow();
    expect(
      await validateFile(
        new File(["%PDF-1.7"], "good.pdf", { type: "application/pdf" }),
      ),
    ).toBe("application/pdf");
  });
});
