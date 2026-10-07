/**
 * Everything that isn't copy: names, links, contacts.
 * Copy lives in src/content/*. Every placeholder is marked TODO.
 */
export const site = {
  lang: 'ru',
  // TODO: real name
  name: 'Анна Соколова',
  // TODO: confirm wording
  role: 'психолог · КПТ и CFT',
  description: 'TODO: одна-две фразы для поисковиков — кто она и с чем работает.',
  // TODO: real booking link (Calendly / Telegram bot / form)
  bookingUrl: 'https://example.com/booking',
  socials: [
    // TODO: real handles
    { label: 'Telegram', href: 'https://t.me/username' },
    { label: 'Instagram', href: 'https://instagram.com/username' },
  ],
  // TODO: real email
  email: 'hello@example.com',
} as const;

export type Site = typeof site;
