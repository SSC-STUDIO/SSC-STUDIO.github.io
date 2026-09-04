import { isSafeReturnTo, resolveReturnTo } from "../src/utils/safe-return-to.ts";

const cases = [
  [null, false],
  ["", false],
  ["https://evil.example", false],
  ["//evil.example", false],
  ["/\\evil.example", false],
  ["/\\\\evil.example", false],
  ["/\tevil", false],
  ["/foo://bar", false],
  ["/messages", true],
  ["/admin", true],
  ["/messages?x=1", true],
  ["/class#top", true],
];

let failed = 0;
for (const [raw, expected] of cases) {
  const got = isSafeReturnTo(raw);
  if (got !== expected) {
    failed += 1;
    console.error(`isSafeReturnTo(${JSON.stringify(raw)}) → ${got}, want ${expected}`);
  }
}

const resolveCases = [
  ["/leaderboard", "?returnTo=/messages", "/messages"],
  ["/leaderboard", "?returnTo=//evil.example", "/leaderboard"],
  ["/leaderboard", "?returnTo=https://evil.example", "/leaderboard"],
  ["/leaderboard", "?returnTo=/\\evil.example", "/leaderboard"],
  ["/leaderboard", "?returnTo=%2F%2Fevil.example", "/leaderboard"],
  ["/leaderboard", "?returnTo=/admin", "/admin"],
  ["https://evil.example", "", "/leaderboard"],
];

for (const [fallback, search, expected] of resolveCases) {
  const got = resolveReturnTo(fallback, search);
  if (got !== expected) {
    failed += 1;
    console.error(
      `resolveReturnTo(${JSON.stringify(fallback)}, ${JSON.stringify(search)}) → ${got}, want ${expected}`,
    );
  }
}

if (failed) {
  console.error(`failed: ${failed}`);
  process.exit(1);
}
console.log("safe-return-to: ok");
