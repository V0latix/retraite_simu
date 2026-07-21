// French number formatting. `.toFixed()` was leaking English decimals ("1.4 %")
// into the macro/comparison/stochastic views next to the "1,4 %" of the other
// charts. Intl gives the decimal comma for free.
// ponytail: build a formatter per call — cheap at this render volume, memoize if it shows up in a profile.
const nf = (digits: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Plain number: fmtNum(1.4, 1) → "1,4". */
export const fmtNum = (v: number, digits = 0) => nf(digits).format(v)

/** Percent from a ratio: fmtPct(0.014) → "1,4 %". */
export const fmtPct = (ratio: number, digits = 1) => `${nf(digits).format(ratio * 100)} %`

/** Percent from an already-scaled value: fmtPctRaw(1.4) → "1,4 %". */
export const fmtPctRaw = (v: number, digits = 1) => `${nf(digits).format(v)} %`

/** Billions of euros: fmtBn(-8.7e9) → "-8,7 Md€". */
export const fmtBn = (euros: number, digits = 1) => `${nf(digits).format(euros / 1e9)} Md€`
