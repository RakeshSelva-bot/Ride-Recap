import { readFileSync } from "node:fs";
import { parseUpiCsv } from "../lib/upi";
import { parseTimeline } from "../lib/timeline";

function expectThrow(label: string, fn: () => unknown) {
  try {
    fn();
    console.log(`  FAIL  ${label}: did not throw`);
  } catch (e) {
    console.log(`  OK    ${label}: ${(e as Error).message}`);
  }
}

function expectOk(label: string, fn: () => unknown) {
  try {
    fn();
    console.log(`  OK    ${label}`);
  } catch (e) {
    console.log(`  FAIL  ${label}: ${(e as Error).message}`);
  }
}

const fakePdf = "%PDF-1.4\n\x00\x01stream\nendobj\n";
const fakeHtml = "<!DOCTYPE html><html><body>foo</body></html>";
const fakeZip = "PK\x03\x04junk\x00\x00";
const fakeBinary = "abc\x00def\x00ghi\x00".repeat(50);
const realCsv = readFileSync("samples/upi.csv", "utf8");
const realJson = readFileSync("samples/timeline.json", "utf8");

console.log("UPI parser:");
expectThrow("PDF rejected", () => parseUpiCsv(fakePdf));
expectThrow("HTML rejected", () => parseUpiCsv(fakeHtml));
expectThrow("ZIP rejected", () => parseUpiCsv(fakeZip));
expectThrow("Binary rejected", () => parseUpiCsv(fakeBinary));
expectOk("Real CSV accepted", () => parseUpiCsv(realCsv));

console.log("\nTimeline parser:");
expectThrow("PDF rejected", () => parseTimeline(fakePdf));
expectThrow("HTML rejected", () => parseTimeline(fakeHtml));
expectThrow("Binary rejected", () => parseTimeline(fakeBinary));
expectOk("Real JSON accepted", () => parseTimeline(realJson));
