// F-508b: privacy guard for org_knowledge text. Org-level facts only; anything that looks like a client record is refused.
// Results name the rule only and never echo the text (PRIVACY_AND_COMPLIANCE.md).

export const CATEGORIES = ['mission', 'program', 'service_model', 'staffing', 'budget', 'eligibility', 'outcome', 'boilerplate', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const BODY_MAX = 8000;

export type TextRule = 'ssn' | 'date_of_birth' | 'phone' | 'email' | 'street_address' | 'case_number';
export type Rule = TextRule | 'empty' | 'too_long' | 'needs_source';
export type GuardResult = { ok: true } | { ok: false; rules: Rule[]; message: string };

const SUFFIX = 'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Circle|Cir|Parkway|Pkwy|Highway|Hwy';
const PATTERNS: Record<TextRule, RegExp> = {
  ssn: /\b\d{3}[- ]\d{2}[- ]\d{4}\b|\bssn\b/i,
  date_of_birth: /\b(?:d\.?o\.?b\.?|date of birth|birth\s?date|born on)\b/i,
  phone: /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  // "123 Maple Street", "45 N Oak Dr." and Utah grid addresses such as "1234 S 500 E"
  street_address: new RegExp(`\\b\\d{1,6}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][a-z]+\\s+){1,3}(?:${SUFFIX})\\b\\.?|\\b\\d{1,6}\\s+[NSEW]\\.?\\s+\\d{1,5}\\s+[NSEW]\\b`),
  // "case no. 241900123", "docket #A-77", Utah-style "24-JV-00123"
  case_number: /\b(?:case|docket|cause)\s*(?:no\.?|number|num\.?|#)\s*:?\s*[A-Z0-9][A-Z0-9-]{2,}|\b\d{2,4}-[A-Z]{1,4}-\d{3,}\b/i,
};

const MESSAGES: Record<Rule, string> = {
  ssn: 'looks like a Social Security number', date_of_birth: 'mentions a date of birth', phone: 'contains a phone number', email: 'contains an email address',
  street_address: 'contains a street address', case_number: 'contains a case or docket number', empty: 'is empty', too_long: `is longer than ${BODY_MAX} characters`, needs_source: 'has numbers but no source and as-of date',
};

const result = (rules: Rule[]): GuardResult => (!rules.length ? { ok: true }
  : { ok: false, rules, message: `Not saved: the text ${rules.map((r) => MESSAGES[r]).join('; ')}. Store org-level facts only.` });

/** Pure. Rejects client-identifying patterns; reports which rules matched, never the matched text. */
export function checkKnowledgeText(body: string): GuardResult {
  const rules: Rule[] = [];
  if (!body.trim()) rules.push('empty');
  if (body.length > BODY_MAX) rules.push('too_long');
  for (const [rule, re] of Object.entries(PATTERNS) as [TextRule, RegExp][]) if (re.test(body)) rules.push(rule);
  return result(rules);
}

export type KnowledgeFields = { category: Category; title: string; body: string; source?: string | null; as_of?: string | null };

/** Full pre-write check: title and body through the text rules, and numbers in outcome/budget rows need source and as_of. */
export function checkKnowledge(f: KnowledgeFields): GuardResult {
  const title = checkKnowledgeText(f.title);
  const body = checkKnowledgeText(f.body);
  const rules = new Set<Rule>([...(title.ok ? [] : title.rules), ...(body.ok ? [] : body.rules)]);
  const dated = !!f.source?.trim() && !!f.as_of && /^\d{4}-\d{2}-\d{2}$/.test(f.as_of);
  if ((f.category === 'outcome' || f.category === 'budget') && /\d/.test(f.body) && !dated) rules.add('needs_source');
  return result([...rules]);
}
