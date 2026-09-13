export type DocKind = "invoice" | "quotation";

/** Draft -> Sent -> Paid. Quotations use draft/sent/accepted-as-paid loosely. */
export type DocStatus = "draft" | "sent" | "paid";

export interface LineItem {
  id: string;
  /** Short heading, e.g. "R.C. GUTTER LEAKING". */
  title: string;
  /** Free-text detail lines, e.g. "Supply labour to pressure wash rc gutter...". */
  description: string;
  /** Unit of measure, e.g. "ft run", "sq ft", "nos". Optional. */
  unit: string;
  /** Quantity. Empty string when the item is priced as a lump sum. */
  quantity: string;
  /** Price per unit. Empty string when the item is priced as a lump sum. */
  unitPrice: string;
  /** Lump-sum amount, used whenever quantity and unitPrice are not both set. */
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
