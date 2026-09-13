export type DocKind = "invoice" | "quotation";

/**
 * How a line is priced. This is the user's explicit choice, not something
 * inferred from which fields happen to be filled in — otherwise clearing the
 * quantity box to retype it would silently switch the line back to a lump sum.
 */
export type PricingMode = "lump" | "unit";

/** Draft -> Sent -> Paid. Quotations use draft/sent/accepted-as-paid loosely. */
export type DocStatus = "draft" | "sent" | "paid";

export interface LineItem {
  id: string;
  /** Which of the two pricing shapes below applies. */
  pricing: PricingMode;
  /** Short heading, e.g. "R.C. GUTTER LEAKING". */
  title: string;
  /** Free-text detail lines, e.g. "Supply labour to pressure wash rc gutter...". */
  description: string;
  /** Unit of measure, e.g. "ft run", "sq ft", "nos". Optional. */
  unit: string;
  /** Quantity. Used when `pricing` is "unit". May be blank mid-edit. */
  quantity: string;
  /** Price per unit. Used when `pricing` is "unit". May be blank mid-edit. */
  unitPrice: string;
  /** Lump-sum amount. Used when `pricing` is "lump". */
  amount: string;
}

export interface Client {
  company: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
}

export interface CompanyProfile {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  signatureName: string;
  currencyCode: string;
  currencyWord: string;
}

export interface InvoiceDoc {
  id: string;
  kind: DocKind;
  /** Document number as printed, e.g. "023/2026". */
  number: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  client: Client;
  /** Scope heading above the item table, e.g. "SLIDING GATE UPGRADE AND REPAINT". */
  jobTitle: string;
  items: LineItem[];
  notes: string;
  status: DocStatus;
  /** ISO date the document was marked paid. Empty when unpaid. */
  paidDate: string;
  /**
   * ISO timestamp of when this was moved to the bin. Empty for live jobs.
   * Deleting keeps the record so a mistake can be undone; only "delete
   * forever" actually removes it.
   */
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_COMPANY: CompanyProfile = {
  name: "CN WONG RENOVATION COMPANY",
  addressLine1: "KOLOMBONG",
  addressLine2: "",
  phone: "0168266751",
  bankName: "Hong Leong Bank Berhad",
  bankAccount: "11100096865",
  signatureName: "Wong Chian Ngip",
  currencyCode: "RM",
  currencyWord: "Ringgit Malaysia",
};
