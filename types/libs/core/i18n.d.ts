export function setLocale(newLocale: any): void;
export function getLocale(): string;
export function addMessages(forLocale: any, texts: any): void;
/**
 * Looks a text up in the current locale, then in its base language ("hu-HU" -> "hu"), then in English.
 * Unknown keys are returned as they are. {name} placeholders are replaced from params.
 */
export function translate(key: any, params?: {}): any;
