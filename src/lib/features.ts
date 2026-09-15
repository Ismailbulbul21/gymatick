/** Parts of GYMATICK that are switched off for this gym. Their data and database functions stay,
 *  so a feature can be turned back on later without losing anything. */
export const FEATURES = {
  /** Customer records: the Customers screen and the customer picker on income and invoices. */
  customers: false,
} as const
