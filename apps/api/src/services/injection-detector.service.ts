const PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /you\s+are\s+now/i,
  /disregard|forget\s+your/i,
  /\[INST\]|<\|im_start\|>|<\|endoftext\|>|###\s*(system|user|assistant)/i,
  /"role"\s*:/i,
];

export function detectInjection(input: string): boolean {
  const normalized = input.normalize("NFKD");

  return PATTERNS.some((pattern) => pattern.test(normalized));
}
