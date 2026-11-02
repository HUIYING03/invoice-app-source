import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canIndent,
  canMove,
  canOutdent,
  fixLevels,
  groupTotal,
  insertChild,
  itemNumbers,
  moveItem,
  removeItem,
  shiftLevel,
} from "../src/lib/items.ts";
import type { ItemLevel, LineItem } from "../src/lib/types.ts";

function line(id: string, level: ItemLevel, amount = ""): LineItem {
  return {
    id,
    level,
    pricing: "lump",
    title: id,
    description: "",
    unit: "",
    quantity: "",
    unitPrice: "",
    amount,
  };
}

const ids = (items: LineItem[]) => items.map((item) => item.id).join(" ");
const levels = (items: LineItem[]) => items.map((item) => item.level).join("");

test("numbers items 1. 2., sub-items a. b., sub-sub-items i. ii.", () => {
  const items = [
    line("A", 0), line("Aa", 1), line("Aai", 2), line("Aaii", 2), line("Ab", 1),
    line("B", 0), line("Ba", 1),
  ];
  assert.deepEqual(itemNumbers(items), ["1.", "a.", "i.", "ii.", "b.", "2.", "a."]);
});

test("long runs keep counting: z. then aa., and roman numerals", () => {
  const subs = Array.from({ length: 27 }, (_, i) => line(`s${i}`, 1));
  const numbers = itemNumbers([line("A", 0), ...subs]);
  assert.equal(numbers[26], "z.");
  assert.equal(numbers[27], "aa.");
  const deep = Array.from({ length: 9 }, (_, i) => line(`d${i}`, 2));
  assert.equal(itemNumbers([line("A", 0), line("a", 1), ...deep])[2 + 8], "ix.");
});

test("fixLevels stops a line from nesting deeper than the one above allows", () => {
  assert.equal(levels(fixLevels([line("A", 2), line("B", 2), line("C", 0), line("D", 2)])), "0101");
});

test("indent and outdent carry sub-lines along", () => {
  const items = [line("A", 0), line("B", 0), line("Ba", 1)];
  assert.equal(canIndent(items, 0), false);
  assert.equal(canIndent(items, 1), true);
  assert.equal(levels(shiftLevel(items, 1, 1)), "012");
  assert.equal(canOutdent(items, 0), false);
  assert.equal(levels(shiftLevel(shiftLevel(items, 1, 1), 1, -1)), "001");
});

test("a sub-sub-item cannot go any deeper", () => {
  const items = [line("A", 0), line("a", 1), line("i", 2)];
  assert.equal(canIndent(items, 2), false);
  assert.equal(insertChild(items, 2, line("x", 0)), items);
});

test("moving swaps a line and its sub-lines with the neighbour at the same level", () => {
  const items = [line("A", 0), line("Aa", 1), line("B", 0), line("Ba", 1), line("Bb", 1)];
  assert.equal(ids(moveItem(items, 0, 1)), "B Ba Bb A Aa");
  assert.equal(ids(moveItem(items, 2, -1)), "B Ba Bb A Aa");
  assert.equal(ids(moveItem(items, 4, -1)), "A Aa B Bb Ba");
  // A first sub-item has no earlier sibling to swap with.
  assert.equal(canMove(items, 1, -1), false);
  assert.equal(canMove(items, 1, 1), false);
});

test("removing a line keeps its sub-lines, one level up", () => {
  const items = [line("A", 0), line("Aa", 1), line("Aai", 2), line("B", 0)];
  const after = removeItem(items, 0);
  assert.equal(ids(after), "Aa Aai B");
  assert.equal(levels(after), "010");
});

test("a new sub-item goes after the existing ones", () => {
  const items = [line("A", 0), line("Aa", 1), line("B", 0)];
  const after = insertChild(items, 0, line("new", 0));
  assert.equal(ids(after), "A Aa new B");
  assert.equal(levels(after), "0110");
});

test("group total adds the line and everything under it", () => {
  const items = [line("A", 0, "100"), line("Aa", 1, "20"), line("Aai", 2, "3"), line("B", 0, "999")];
  assert.equal(groupTotal(items, 0), 123);
  assert.equal(groupTotal(items, 1), 23);
});
