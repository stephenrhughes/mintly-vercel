import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

/** A tick or cross, optionally with a short text, or a plain text cell. */
export type ComparisonValue = boolean | { ok: boolean; text?: string } | string;
export type ComparisonRow = { feature: ReactNode; note?: ReactNode; values: ComparisonValue[] };

function Cell({ value }: { value: ComparisonValue }) {
  if (typeof value === "string") return <span className="text-muted-foreground">{value}</span>;
  const { ok, text } = typeof value === "boolean" ? { ok: value, text: undefined } : value;
  return (
    <span className="inline-flex flex-col items-center gap-1">
      {ok ? (
        <Check className="size-5 text-primary" aria-label="Yes" />
      ) : (
        <X className="size-5 text-muted-foreground" aria-label="No" />
      )}
      {text && <span className="text-xs text-muted-foreground">{text}</span>}
    </span>
  );
}

/** A feature table with ticks and crosses, labelled for screen readers. */
export function ComparisonTable({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) {
  return (
    <div className="mt-10 overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="p-4 font-semibold">
              Feature
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className="p-4 text-center font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr key={index}>
              <th scope="row" className="p-4 text-left font-medium">
                {row.feature}
                {row.note && (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {row.note}
                  </span>
                )}
              </th>
              {row.values.map((value, i) => (
                <td key={i} className="p-4 text-center">
                  <Cell value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
