// Utility file for advanced text sanitization or future backend logic

export function sanitizeText(text) {
  // Example: basic sanitization
return text.replace(/(drop table|delete|insert|password)/gi, "[REDACTED]");
}
