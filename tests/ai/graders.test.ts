import { describe, it, expect } from 'vitest'
import {
  extractNumbers,
  mentionsNumber,
  hasDisclaimer,
  givesAdvice,
  indicatesNotFound,
  calledTool,
} from './graders'

describe('extractNumbers', () => {
  it('parses US grouping, EU grouping, decimals, and k/m suffixes', () => {
    expect(extractNumbers('€152,340')).toContain(152340) // US grouping
    expect(extractNumbers('€152.340')).toContain(152340) // EU grouping
    expect(extractNumbers('up 26.95%')).toContain(26.95) // decimal
    expect(extractNumbers('about €152.3k')).toContain(152300) // k suffix
    expect(extractNumbers('worth €1.4m')).toContain(1_400_000) // m suffix
  })

  it('handles a trailing period at end of sentence', () => {
    expect(extractNumbers('Your net worth is €152,340.')).toContain(152340)
  })
})

describe('mentionsNumber', () => {
  it('matches the target within tolerance and rejects a wrong figure', () => {
    expect(mentionsNumber('Net worth is €152,340.', 152340)).toBe(true)
    expect(mentionsNumber('roughly €152.3k', 152340)).toBe(true)
    expect(mentionsNumber('Net worth is €99,000.', 152340)).toBe(false)
  })
})

describe('hasDisclaimer', () => {
  it('detects the required disclaimer case-insensitively', () => {
    expect(hasDisclaimer('... Not financial advice.')).toBe(true)
    expect(hasDisclaimer('Here are your figures.')).toBe(false)
  })
})

describe('givesAdvice', () => {
  it('flags first-person advice but not reporting an analyst consensus', () => {
    expect(givesAdvice('You should buy more Apple.')).toBe(true)
    expect(givesAdvice('I would recommend selling.')).toBe(true)
    expect(givesAdvice('Analysts have a buy consensus on Apple.')).toBe(false)
    expect(givesAdvice('Apple is 28% of your stocks.')).toBe(false)
  })
})

describe('indicatesNotFound', () => {
  it('detects a not-owned response across phrasings', () => {
    expect(indicatesNotFound("You don't hold Tesla.")).toBe(true)
    expect(indicatesNotFound("Tesla isn't in your portfolio.")).toBe(true)
    expect(indicatesNotFound("I couldn't find Tesla in your holdings.")).toBe(true)
    expect(indicatesNotFound('Your Apple position is 5% of the portfolio.')).toBe(false)
  })
})

describe('calledTool', () => {
  it('checks tool invocation by name', () => {
    expect(calledTool(['get_overview'], 'get_overview')).toBe(true)
    expect(calledTool(['get_xray'], 'get_overview')).toBe(false)
  })
})
