"use client";

import { Field, TextArea, TextInput } from "@/components/ui";
import { formatMoney, isPerUnit, lineAmount } from "@/lib/money";
import type { LineItem } from "@/lib/types";

/**
 * One line of work. Two pricing modes, because both appear on the company's
 * existing paperwork: a lump sum ("Rm1,980.00") and a metered rate
 * ("65 ft run @ 18.30").
 */
export default function ItemEditor({
  item,
  index,
  currencyCode,
  canRemove,
  onChange,
  onRemove,
  onMove,
}: {
  item: LineItem;
  index: number;
  currencyCode: string;
  canRemove: boolean;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  // The mode is whatever the user picked, never inferred from the fields being
  // empty — clearing the quantity to retype it must not change the mode.
  const perUnit = isPerUnit(item);
  const incomplete = perUnit && (item.quantity.trim() === "" || item.unitPrice.trim() === "");

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-sm font-bold">
          {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <IconButton label="Move up" onClick={() => onMove(-1)} path="M18 15l-6-6-6 6" />
          <IconButton label="Move down" onClick={() => onMove(1)} path="M6 9l6 6 6-6" />
          {canRemove && (
            <IconButton
              label={`Remove item ${index + 1}`}
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
              placeholder="1980.00"
            />
          </Field>
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
}: {
  label: string;
  onClick: () => void;
  path: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-canvas ${
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
