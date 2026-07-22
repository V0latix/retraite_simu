import { oecdComparison } from '../data/loader'
import { CHART } from './chartColors'
import { Card } from '@/components/ui/card'

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')} %`

/** France vs Europe — OCDE Panorama des pensions 2023 (§4). Static reference table with an
 *  inline bar for the net replacement rate. No chart library, no engine input: pure context. */
export function InternationalComparison() {
  const { countries, meta } = oecdComparison
  const maxRr = Math.max(...countries.map((c) => c.netReplacementRate))
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-sm font-medium">France vs Europe — taux de remplacement, dépenses, âge de sortie (OCDE 2023)</h3>
      <p className="text-xs text-muted-foreground">
        Situer le débat français : la France combine un taux de remplacement net élevé, des dépenses de retraite parmi les plus
        fortes de l'OCDE (≈ {pct(countries[0].publicPensionExpenditurePctGdp, 0)} du PIB vs {pct(countries[1].publicPensionExpenditurePctGdp, 0)} en
        moyenne) et un âge de sortie du marché du travail parmi les plus bas.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm" role="img" aria-label="Comparaison internationale OCDE 2023 : taux de remplacement net, dépenses publiques de retraite en pourcentage du PIB, âge effectif de sortie.">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Pays</th>
              <th className="py-1 pr-2 font-medium">Taux de remplacement net</th>
              <th className="py-1 pr-2 text-right font-medium">Dépenses % PIB</th>
              <th className="py-1 text-right font-medium">Âge de sortie (H)</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code} className={`border-b border-border/50 ${c.highlight ? 'font-semibold' : ''}`}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{c.name}</td>
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1" style={{ maxWidth: 160, background: 'var(--muted, #eee)' }}>
                      <div
                        className="h-3"
                        style={{ width: `${(c.netReplacementRate / maxRr) * 100}%`, backgroundColor: c.highlight ? CHART.primary : CHART.blue }}
                      />
                    </div>
                    <span className="tabular-nums">{pct(c.netReplacementRate, 0)}</span>
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{pct(c.publicPensionExpenditurePctGdp, 1)}</td>
                <td className="py-1.5 text-right tabular-nums">{c.effectiveExitAge.toFixed(0).replace('.', ',')} ans</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {meta.note} Source : {meta.source}.
      </p>
    </Card>
  )
}
