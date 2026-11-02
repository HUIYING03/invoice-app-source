"use client";

import { Field, TextArea, TextInput } from "@/components/ui";
import { LEVEL_NAMES, MAX_LEVEL, levelOf } from "@/lib/items";
import { formatMoney, isPerUnit, lineAmount } from "@/lib/money";
import type { LineItem } from "@/lib/types";

/**
 * One line of work. Two pricing modes, because both appear on the company's
 * existing paperwork: a lump sum ("Rm1,980.00") and a metered rate
 * ("65 ft run @ 18.30").
 *
 * A line can also be a sub-item (a.) or sub-sub-item (i.) of the line above
 * it; the side arrows change that at any time.
 */

// Indent per level, so the nesting reads at a glance on a phone.
const INDENT = ["", "ml-4 border-l-4 border-l-brand/40", "ml-8 border-l-4 border-l-brand/20"];
export default function ItemEditor({
  item,
  number,
  currencyCode,
  canRemove,
  canMoveUp,
  canMoveDown,
  canIndent,
  canOutdent,
  groupTotal,
  onChange,
  onRemove,
  onMove,
  onShiftLevel,
  onAddChild,
}: {
  item: LineItem;
  /** Printed label, e.g. "1.", "a." or "ii.". */
  number: string;
  currencyCode: string;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  /** This line plus its sub-lines, or null when it has none. */
  groupTotal: number | null;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onShiftLevel: (delta: -1 | 1) => void;
  onAddChild: () => void;
}) {
  const level = levelOf(item);
  const levelName = LEVEL_NAMES[level];
  // The mode is whatever the user picked, never inferred from the fields being
  // empty — clearing the quantity to retype it must not change the mode.
  const perUnit = isPerUnit(item);
  const incomplete = perUnit && (item.quantity.trim() === "" || item.unitPrice.trim() === "");

  return (
    <div className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${INDENT[level]}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-canvas px-2 text-sm font-bold">
            {number}
          </span>
          <span className="truncate text-xs font-medium text-muted">{levelName}</span>
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton
            label={`Make ${levelName.toLowerCase()} ${number} one level higher`}
            onClick={() => onShiftLevel(-1)}
            disabled={!canOutdent}
            path="M15 18l-6-6 6-6"
          />
          <IconButton
            label={`Make ${levelName.toLowerCase()} ${number} a sub-item of the line above`}
            onClick={() => onShiftLevel(1)}
            disabled={!canIndent}
            path="M9 18l6-6-6-6"
          />
          <IconButton
            label="Move up"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            path="M18 15l-6-6-6 6"
          />
          <IconButton
            label="Move down"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            path="M6 9l6 6 6-6"
          />
          {canRemove && (
            <IconButton
              label={`Remove ${levelName.toLowerCase()} ${number}`}
              onClick={onRemove}
              path="M3 6h18M8 6V4h8v2m-9 0v14h10V6"
              danger
            />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Field label="What is the work?">
          <TextInput
            value={item.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="e.g. R.C. Gutter Leaking"
          />
        </Field>

        <Field label="Details" hint="One line per point. This prints under the title.">
          <TextArea
            rows={3}
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="e.g. Supply labour to pressure wash rc gutter and apply sika 107 waterproofing."
          />
        </Field>

        <div className="flex gap-2 rounded-xl bg-canvas p-1">
          <ModeButton
            active={!perUnit}
            label="One price"
            onClick={() => onChange({ pricing: "lump" })}
          />
          <ModeButton
            active={perUnit}
            label="Per unit"
            onClick={() => onChange({ pricing: "unit" })}
          />
        </div>

        {perUnit ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Quantity">
                <TextInput
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(event) => onChange({ quantity: event.target.value })}
                  placeholder="65"
                />
              </Field>
              <Field label="Unit">
                <TextInput
                  value={item.unit}
                  onChange={(event) => onChange({ unit: event.target.value })}
                  placeholder="ft run"
                />
              </Field>
              <Field label="Price each">
                <TextInput
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(event) => onChange({ unitPrice: event.target.value })}
                  placeholder="18.30"
                />
              </Field>
            </div>
            <div className="flex items-baseline justify-between rounded-xl bg-canvas px-3 py-2.5">
              <span className="text-sm font-medium text-muted">Line total</span>
              <span className="text-lg font-bold tabular-nums">
                {currencyCode} {formatMoney(lineAmount(item))}
              </span>
            </div>
            {incomplete && (
              <p className="text-xs text-warn">
                Fill in both quantity and price each, or switch back to “One price”.
              </p>
            )}
          </>
        ) : (
          <Field label={`Amount (${currencyCode})`}>
            <TextInput
              inputMode="decimal"
              value={item.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              placeholder={level === 0 ? "1980.00" : "Leave blank if priced above"}
            />
          </Field>
        )}

        {groupTotal !== null && (
          <div className="flex items-baseline justify-between rounded-xl bg-canvas px-3 py-2.5">
            <span className="text-sm font-medium text-muted">With sub-items</span>
            <span className="font-bold tabular-nums">
              {currencyCode} {formatMoney(groupTotal)}
            </span>
          </div>
        )}

        {level < MAX_LEVEL && (
          <button
            type="button"
            onClick={onAddChild}
            className="w-full rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-brand"
          >
            + Add {LEVEL_NAMES[level + 1].toLowerCase()} under {number}
          </button>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white text-ink shadow-sm" : "text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  path,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  path: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-canvas disabled:opacity-25 disabled:hover:bg-transparent ${
        danger ? "text-red-600" : "text-muted"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
