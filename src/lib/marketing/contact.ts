// How to reach Mintly, in one place (ported from mintly-web
// src/utils/contactDetails.js). The FAQ, the footer, the about page and the
// schema.org contact points all read these.

/** Existing customers: accounts, billing, a check that looks wrong. */
export const SUPPORT_EMAIL = "support@mintly.uk";

/** Everything pre-sales: pricing, volumes, partnerships, EISCD licensing. */
export const SALES_EMAIL = "info@mintly.uk";

export const SUPPORT_PHONE = "0330 043 2274";
export const SUPPORT_PHONE_HREF = "tel:+443300432274";
/** International form, for schema.org. */
export const SUPPORT_PHONE_INTL = "+44 330 043 2274";

export const SUPPORT_HOURS = "Weekdays, 9am to 6pm UK time";
export const SUPPORT_HOURS_SHORT = "Mon-Fri, 9am-6pm";

export const SUPPORT_HOURS_SCHEMA = {
  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  opens: "09:00",
  closes: "18:00",
};

export const COMPANY = {
  legalName: "Mintly Ltd",
  number: "14347501",
  vat: "GB434423319",
  street: "86-90 Paul St",
  locality: "London",
  postcode: "EC2A 4NE",
  country: "United Kingdom",
};

export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/mintly.uk/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mintly-uk" },
  { label: "Threads", href: "https://threads.net/@mintly.uk" },
];

export const API_STATUS_URL = "https://stats.uptimerobot.com/tDhF7Tt98Y";
