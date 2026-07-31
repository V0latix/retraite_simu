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

/**
 * Nombre saisi à la main → `number`. Accepte la virgule ET le point : le clavier de l'utilisateur
 * ne suit pas forcément la locale du navigateur, et `<input type="number">` rend une valeur vide
 * dès qu'on tape une virgule sur un navigateur en locale anglaise. Tolère aussi ce qu'on peut
 * recopier depuis l'affichage : séparateurs de milliers (espace, U+00A0, U+202F) et le moins
 * typographique U+2212 que produisent nos `fmt`.
 * Renvoie `null` si ce n'est pas un nombre — l'appelant garde alors la valeur courante.
 */
export function parseFrNumber(s: string): number | null {
  const cleaned = s
    .replace(/[\s  ]/g, '')
    .replace(/−/g, '-')
    .replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
