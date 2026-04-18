import stateLaws from '../data/stateLaws'

const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export function buildDemandLetter({
  workerName, employerName, payPeriod, stateCode, stateName,
  violations, totalOwed, agencyName,
}) {
  const worker = workerName || '[YOUR NAME]'
  const employer = employerName || '[EMPLOYER NAME]'
  const period = payPeriod || '[PAY PERIOD]'
  const state = stateLaws[stateCode]

  const violationLines = violations.map(v =>
    `    - ${v.type === 'unpaid_overtime' ? 'Unpaid Overtime' : v.type === 'missing_hours' ? 'Missing Hours' : v.type === 'minimum_wage' ? 'Minimum Wage Violation' : v.type === 'unpaid_double_time' ? 'Unpaid Double Time' : v.type === 'meal_break_violation' ? 'Meal Break Violation' : 'Pay Discrepancy'}: $${v.dollarAmount.toFixed(2)} (${v.citation})`
  ).join('\n')

  return `TEMPLATE: NOT LEGAL ADVICE. Review and customize before sending. Consult an attorney.

${today()}

${employer}
[EMPLOYER ADDRESS]
[CITY, STATE ZIP]

Re: Formal Demand for Unpaid Wages
Pay Period: ${period}

Dear ${employer},

I am writing to formally demand payment of wages owed to me for work performed during the pay period of ${period}. After careful review of my time records and pay stub, I have identified the following discrepancies totaling $${totalOwed.toFixed(2)}:

${violationLines}

These violations are in breach of the Fair Labor Standards Act (FLSA) and ${state?.statutes?.payday || 'applicable state labor law'}. Under federal law, employers are required to compensate employees for all hours worked, including overtime at a rate of not less than one and one-half times the regular rate of pay for hours worked in excess of 40 in a workweek.

I am requesting that you remit payment of $${totalOwed.toFixed(2)} within ten (10) business days of receipt of this letter.

Please be advised that under the FLSA, if this matter proceeds to litigation, I may be entitled to recover liquidated damages equal to the amount of unpaid wages (effectively doubling the recovery to $${(totalOwed * 2).toFixed(2)}), plus reasonable attorney fees and court costs, which are paid by the employer under FLSA Section 16(b).

I also reserve the right to file a formal wage claim with the ${agencyName} and to seek legal counsel regarding these violations. I trust that you will resolve this matter promptly and in good faith.

Sincerely,

_____________________________
${worker}
[YOUR ADDRESS]
[YOUR PHONE NUMBER]
[YOUR EMAIL]

cc: Personal records
    ${agencyName} (if unresolved)`
}

export function buildComplaintForm({
  workerName, employerName, employerAddress, payPeriod, stateCode, stateName,
  violations, totalOwed, agencyName, formName,
}) {
  const worker = workerName || '[YOUR NAME]'
  const employer = employerName || '[EMPLOYER NAME]'
  const empAddr = employerAddress || '[EMPLOYER ADDRESS]'
  const period = payPeriod || '[PAY PERIOD]'

  const violationNarrative = violations.map(v =>
    `During the pay period of ${period}, ${v.explanation}`
  ).join(' ')

  return `TEMPLATE: NOT LEGAL ADVICE. Use this as a guide when filling out the official ${formName}.

=== ${formName.toUpperCase()} ===
Filing with: ${agencyName}
State: ${stateName} (${stateCode})

--- SECTION 1: CLAIMANT INFORMATION ---
Name: ${worker}
Address: [YOUR ADDRESS]
City/State/Zip: [YOUR CITY, STATE ZIP]
Phone: [YOUR PHONE]
Email: [YOUR EMAIL]

--- SECTION 2: EMPLOYER INFORMATION ---
Employer Name: ${employer}
Employer Address: ${empAddr}
Employer Phone: [EMPLOYER PHONE]
Type of Business: [e.g., Restaurant, Construction, Healthcare]
Your Job Title: [YOUR JOB TITLE]
Date of Hire: [YOUR HIRE DATE]
Still Employed: [YES/NO]
Hourly Rate: $${violations[0]?.dollarAmount ? (totalOwed / violations.length).toFixed(2) : '0.00'} [verify from pay stub]

--- SECTION 3: WAGES CLAIMED ---
Total Amount Owed: $${totalOwed.toFixed(2)}
Pay Period in Dispute: ${period}

Breakdown:
${violations.map(v => `  - ${v.type}: $${v.dollarAmount.toFixed(2)}`).join('\n')}

--- SECTION 4: DESCRIPTION OF CLAIM ---
${violationNarrative}

The total amount of unpaid wages I am claiming is $${totalOwed.toFixed(2)}. I have shift records and pay stub documentation to support this claim.

--- SECTION 5: SUPPORTING DOCUMENTS ---
[ ] Copy of pay stub(s) for the disputed period
[ ] Personal shift log/time records
[ ] ShiftGuard comparison analysis report
[ ] Any written communication about pay or hours
[ ] Photographs of work schedule (if available)

--- SIGNATURE ---
Signature: _____________________________
Date: ${today()}
Print Name: ${worker}`
}

export function buildEvidenceSummary({
  workerName, employerName, payPeriod, stateCode, stateName,
  violations, totalOwed, shifts, paystub,
}) {
  const worker = workerName || '[WORKER NAME]'
  const employer = employerName || '[EMPLOYER NAME]'
  const period = payPeriod || '[PAY PERIOD]'

  const shiftLog = shifts.map(s => {
    const [inH, inM] = s.clockIn.split(':').map(Number)
    const [outH, outM] = s.clockOut.split(':').map(Number)
    let mins = (outH * 60 + outM) - (inH * 60 + inM)
    if (mins < 0) mins += 1440
    mins -= (s.breakMinutes || 0)
    const hrs = (mins / 60).toFixed(1)
    return `  ${s.date}  |  ${s.clockIn} - ${s.clockOut}  |  ${s.breakMinutes}min break  |  ${hrs}h net  |  Tips: $${Number(s.tips || 0).toFixed(2)}${s.flaggedOT ? '  [OT FLAGGED]' : ''}`
  }).join('\n')

  const violationDetail = violations.map(v =>
    `  [${v.severity.toUpperCase()}] ${v.type}\n    Amount: $${v.dollarAmount.toFixed(2)}\n    Statute: ${v.citation}\n    Detail: ${v.explanation}`
  ).join('\n\n')

  return `EVIDENCE SUMMARY
Prepared by ShiftGuard (educational tool, not legal advice)
Generated: ${today()}

========================================
CASE SUMMARY
========================================
Worker: ${worker}
Employer: ${employer}
Pay Period: ${period}
State: ${stateName} (${stateCode})
Total Amount in Controversy: $${totalOwed.toFixed(2)}

========================================
VIOLATIONS DETECTED (${violations.length})
========================================
${violationDetail}

========================================
WORKER SHIFT LOG
========================================
  Date        |  In - Out        |  Break     |  Net Hrs  |  Tips
${shiftLog}

========================================
PAY STUB DATA
========================================
  Employer: ${paystub.employer_name || employer}
  Hours Paid: ${paystub.hours_paid}
  OT Hours Paid: ${paystub.overtime_hours_paid}
  Hourly Rate: $${paystub.hourly_rate}
  OT Rate: $${paystub.overtime_rate}
  Gross Pay: $${paystub.gross_pay}
  Net Pay: $${paystub.net_pay}
  Deductions: ${paystub.deductions?.map(d => `${d.name}: $${d.amount}`).join(', ') || 'None listed'}

========================================
APPLICABLE LAW
========================================
  Federal: Fair Labor Standards Act (FLSA), 29 U.S.C. Section 201 et seq.
  State: ${stateLaws[stateCode]?.statutes?.overtime || 'See state labor code'}
  Overtime: ${stateLaws[stateCode]?.statutes?.minimumWage || 'See state labor code'}

========================================
RECOMMENDED LEGAL ACTIONS
========================================
  1. File a wage claim with ${stateLaws[stateCode]?.complaintAgency?.name || 'state labor agency'}
     URL: ${stateLaws[stateCode]?.complaintAgency?.url || 'See state DOL website'}

  2. Consult an employment attorney. Under the FLSA, prevailing
     plaintiffs may recover:
     - Full unpaid wages ($${totalOwed.toFixed(2)})
     - Liquidated damages (equal amount, total $${(totalOwed * 2).toFixed(2)})
     - Attorney fees and costs (paid by employer)

  3. Statute of Limitations:
     - FLSA: 2 years (3 years if willful violation)
     - Check state-specific deadlines for state claims

========================================
DISCLAIMER
========================================
This document was prepared by ShiftGuard as an educational resource.
It is not legal advice and has not been reviewed by an attorney.
Consult a licensed attorney before taking legal action.`
}
