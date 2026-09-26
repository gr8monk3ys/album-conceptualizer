/**
 * What the credits meter shows. The meter's frame is the Plan's monthly grant; a balance above it
 * (challenge rewards, top-ups) is never drawn as "53 / 50": the figure is the balance and the
 * caption splits it into the monthly grant plus the extra, with the meter full rather than past
 * its end.
 */
export type CreditMeterReading = {
  remaining: number;
  total: number;
  /** Credits above the monthly grant (0 when the balance fits inside it). */
  extra: number;
  /** Fill of the meter, 0–1, capped at a full meter. */
  ratio: number;
  /** The words after the figure: "/ 50" inside the grant, "50 monthly + 3 extra" above it. */
  caption: string;
  /** The meter's spoken value. */
  valueText: string;
};

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

export function readCreditMeter(credits?: { remaining: number; total: number }): CreditMeterReading {
  const remaining = Math.max(0, Math.floor(credits?.remaining ?? 0));
  const total = Math.max(0, Math.floor(credits?.total ?? 0));
  const extra = Math.max(0, remaining - total);
  const ratio = total ? Math.min(1, remaining / total) : remaining > 0 ? 1 : 0;
  if (extra > 0) {
    return {
      remaining,
      total,
      extra,
      ratio,
      caption: total ? `${total} monthly + ${extra} extra` : `${extra} extra`,
      valueText: total
        ? `${remaining} credits left: ${total} monthly plus ${extra} extra`
        : `${remaining} extra ${plural(remaining, "credit", "credits")} left`,
    };
  }
  return {
    remaining,
    total,
    extra,
    ratio,
    caption: `/ ${total}`,
    valueText: `${remaining} of ${total} monthly ${plural(total, "credit", "credits")} left`,
  };
}
