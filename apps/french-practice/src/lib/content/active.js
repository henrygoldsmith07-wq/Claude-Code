// Single source of truth for which language's *content* (vocab packs,
// scenarios, sentence pool) is live. Kept in its own tiny module so both
// vocab.js and data.js can read it without importing each other.

let active = 'fr';

export const setContentLanguage = (id) => { active = ['fr', 'de', 'es'].includes(id) ? id : 'fr'; };
export const contentLang = () => active;
