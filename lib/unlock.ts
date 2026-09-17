/* ---------------------------------------------------------------- */
/*  Lifetime access codes (MVP unlock).                              */
/*                                                                   */
/*  Codes are generated offline into lifetime-codes.csv (one per    */
/*  line, 1,000 codes) and uploaded to AppSumo for CSV-based         */
/*  fulfillment. Each code carries a checksum character, so this     */
/*  validator needs no list in the client bundle.                    */
/*                                                                   */
/*  Format: RR49-XXXX-XXXX-C  where C = checksum over the payload.   */
/*                                                                   */
/*  MVP note: the algorithm ships in client JS. Move to server-side  */
/*  validation once real revenue justifies it.                       */
/* ---------------------------------------------------------------- */

export const UNLOCK_STORAGE_KEY = "outreachai.lifetime";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no 0/1/I/O

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isLifetimeCode(code: string): boolean {
  const c = normalizeCode(code);
  const m = /^RR49-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9])$/.exec(c);
  if (!m) return false;

  const payload = m[1] + m[2];
  let sum = 0;
  for (const ch of payload) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return false; // char outside the alphabet (0, 1, I, O...)
    sum += i;
  }
  return ALPHABET[sum % 32] === m[3];
}
