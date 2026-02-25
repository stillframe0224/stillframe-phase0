import assert from "node:assert/strict";
import test from "node:test";
import {
  migrateCard,
  runSelfHealMigration,
  SELFHEAL_MIGRATION_MAX_PER_RUN,
} from "../../app/app/shinen/lib/selfHealMigration.mjs";

function card(overrides = {}) {
  return {
    id: 1000,
    type: 2,
    text: "memo",
    px: 0,
    py: 0,
    z: -100,
    ...overrides,
  };
}

test("URL-only plain note is normalized to clip type with source.url", () => {
  const input = card({
    type: 4,
    text: "https://x.com/NASA/status/1879211234567890123",
  });
  const migrated = migrateCard(input);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.card.type, 8);
  assert.equal(migrated.card.source?.url, "https://x.com/NASA/status/1879211234567890123");
  assert.match(migrated.card.source?.site || "", /x\.com/i);
});

test("card with source.url but non-clip type is normalized to type 8", () => {
  const input = card({
    type: 0,
    text: "legacy clip",
    source: { url: "https://instagram.com/p/ABC123/", site: "instagram.com" },
  });
  const migrated = migrateCard(input);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.card.type, 8);
  assert.equal(migrated.card.source?.url, "https://instagram.com/p/ABC123/");
});

test("generic X login-wall thumbnail is dropped and unfurl action is enqueued", () => {
  const input = card({
    id: 42,
    type: 8,
    text: "x card",
    source: { url: "https://x.com/user/status/123", site: "x.com" },
    media: {
      type: "image",
      kind: "image",
      url: "https://abs.twimg.com/responsive-web/client-web/og/image.png",
    },
  });
  const migrated = migrateCard(input);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.card.media, undefined);
  assert.equal(
    migrated.actions.some((action) => action.type === "drop_thumbnail"),
    true,
  );
  assert.equal(
    migrated.actions.some(
      (action) =>
        action.type === "enqueue_unfurl" && action.url === "https://x.com/user/status/123",
    ),
    true,
  );
});

test("migration is idempotent", () => {
  const first = migrateCard(
    card({
      type: 4,
      text: "https://x.com/user/status/123",
    }),
  );
  assert.equal(first.changed, true);
  const second = migrateCard(first.card);
  assert.equal(second.changed, false);
});

test("runner caps self-heal to N cards per run", () => {
  const cards = [
    card({ id: 1, type: 2, text: "https://x.com/u/status/1" }),
    card({ id: 2, type: 2, text: "https://x.com/u/status/2" }),
    card({ id: 3, type: 2, text: "https://x.com/u/status/3" }),
  ];
  const result = runSelfHealMigration(cards, { limit: 2 });
  assert.equal(result.appliedCount, 2);
  assert.equal(result.changedCount, 2);
  assert.equal(result.remainingCount, 1);
  assert.equal(result.cards[0].type, 8);
  assert.equal(result.cards[1].type, 8);
  assert.equal(result.cards[2].type, 2);
});

test("runner uses default cap when limit is not provided", () => {
  const cards = Array.from({ length: SELFHEAL_MIGRATION_MAX_PER_RUN + 2 }, (_, i) =>
    card({ id: i + 1, type: 2, text: `https://x.com/u/status/${i + 1}` }),
  );
  const result = runSelfHealMigration(cards);
  assert.equal(result.appliedCount, SELFHEAL_MIGRATION_MAX_PER_RUN);
  assert.equal(result.remainingCount, 2);
});
