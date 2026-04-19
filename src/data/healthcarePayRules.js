/**
 * Educational reference: common healthcare pay components (vary by employer contract).
 * ShiftGuard uses these to explain flags, not to guarantee a given rate.
 */
export const healthcarePayRules = {
  shiftDifferentials: {
    nightShift: {
      description:
        'Shift differentials for night hours (often roughly 3pm–11pm evening, 11pm–7am night, facility-specific).',
      typicalRange: '$1–5/hour premium',
      flagIf: 'You logged night or evening shifts; confirm your facility’s differential appears on your pay advice.',
    },
    weekendDifferential: {
      description: 'Premium pay for weekend shifts (often Saturday–Sunday).',
      typicalRange: '$2–7/hour premium',
      flagIf: 'You logged weekend shifts; confirm weekend premium matches your policy.',
    },
    holidayPay: {
      description: 'Holiday pay (often 1.5× or 2× for hours worked on the holiday).',
      flagIf: 'You logged a holiday shift; confirm pay reflects your facility’s holiday policy.',
    },
    onCallPay: {
      description: 'On-call or callback pay (varies widely by contract).',
      flagIf: 'You logged on-call; confirm on-call or callback pay matches your agreement.',
    },
    chargeNursePay: {
      description: 'Additional pay for charge nurse duties (often ~$1–5/hour).',
      flagIf: 'You logged charge duties; confirm charge pay is reflected.',
    },
    preceptorPay: {
      description: 'Additional pay for precepting new staff (often ~$1–3/hour).',
      flagIf: 'You logged preceptor duties; confirm preceptor pay is reflected.',
    },
  },
}
