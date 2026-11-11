import { policyData } from "@/lib/hotel/policy";

/**
 * Every populated group of the hotel's stored policy data, plus its extra policy text. All of it is supplier
 * text and is rendered as text only. Headings are h3, so the parent supplies the h2.
 */
export function PolicyList({ struct, extraInfo }: { struct: Record<string, unknown> | null; extraInfo: string | null }) {
  const { groups, extra } = policyData(struct, extraInfo);
  if (groups.length === 0 && extra.length === 0) {
    return <p className="text-muted-foreground">The hotel has not shared any further policies.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {groups.length > 0 && (
        <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`policy-${g.key}`} className="flex flex-col gap-2">
              <h3 id={`policy-${g.key}`} className="text-base font-semibold tracking-[0.01em] [word-spacing:0.1em]">{g.title}</h3>
              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {g.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {extra.length > 0 && (
        <section aria-labelledby="policy-extra" className="flex flex-col gap-2">
          <h3 id="policy-extra" className="text-base font-semibold tracking-[0.01em] [word-spacing:0.1em]">More from the hotel</h3>
          <div className="flex max-w-prose flex-col gap-2 text-sm text-muted-foreground">
            {extra.map((line, i) => (
              <p key={i} className={line.startsWith("•") ? "pl-4 -indent-4" : undefined}>{line}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
