import { PRO_PRICES } from '../../billing/pricingConfig';
import { MERCHANT_OF_RECORD, REFUND_DAYS, SELLER, SITE_URL, formatLegalDate } from '../seller';
import type { LegalSet } from '../types';

const OPERATOR = `${SELLER.name}, ${SELLER.entity.en} based in ${SELLER.country.en}`;
const UPDATED = `Last updated: ${formatLegalDate('en')}`;
const MOR = MERCHANT_OF_RECORD;

/** English — the legally binding version. */
export const legalEn: LegalSet = {
  terms: {
    title: 'Terms of Service',
    updated: UPDATED,
    intro: [
      `These Terms of Service ("Terms") govern your use of Moneo, the focus timer and planner available at ${SITE_URL} and as an installable web app (the "Service"). Please read them together with our {privacy} and our {refund}.`,
    ],
    sections: [
      {
        heading: '1. Who operates Moneo',
        blocks: [`Moneo is operated by ${OPERATOR} ("we", "us"). You can reach us at {email}.`],
      },
      {
        heading: '2. Accepting these Terms',
        blocks: [
          'By using the Service or creating an account, you agree to these Terms. If you do not agree, please do not use the Service.',
          'You must be at least 16 years old, or have permission from a parent or legal guardian, to create an account.',
        ],
      },
      {
        heading: '3. The Service',
        blocks: [
          'Moneo helps you plan your day and run focus sessions. It is local-first: most features work without an account, and your data is stored in your browser on your device.',
          'With a Pro account you can sync focus sessions, focus areas and settings to our cloud database. Projects, tasks, plans, goals, habits, journal entries and other planning data stay on your device.',
        ],
      },
      {
        heading: '4. Your account',
        blocks: [
          'You can sign up with an email address and password or with Google. Please give a valid email address, keep your password safe and tell us at {email} if you think someone else has accessed your account. You are responsible for activity under your account.',
          'You can delete your account at any time from the Account page ("Delete account").',
        ],
      },
      {
        heading: '5. Free and Pro plans',
        blocks: [
          'The Free plan has no time limit. It includes the focus timer and a limited number of projects, goals, habits and other items. We may adjust Free limits in the future; we will not remove data you already created because of a limit change.',
          `Pro is a paid subscription: ${PRO_PRICES.monthly} per month or ${PRO_PRICES.yearly} per year. Taxes such as VAT may be added at checkout depending on where you live. The current list of Pro features is shown on the pricing page.`,
        ],
      },
      {
        heading: `6. Payments through ${MOR}`,
        blocks: [
          `Pro subscriptions are sold by ${MOR}, our reseller and Merchant of Record. ${MOR} processes your payment, charges and remits applicable taxes, issues your receipts and invoices, and processes refunds. When you buy Pro, you also accept ${MOR}'s buyer terms, which apply to the purchase itself.`,
          `We never see or store your full card details. We only receive the information needed to link the subscription to your Moneo account (for example the subscription status, plan and renewal date).`,
        ],
      },
      {
        heading: '7. Automatic renewal and cancellation',
        blocks: [
          'Subscriptions renew automatically at the end of each billing period (monthly or yearly) and are charged to your payment method until you cancel.',
          `You can cancel at any time from the customer portal (Account → Manage subscription) or by writing to {email}. Cancellation stops future renewals; you keep Pro until the end of the period you already paid for, and your account then returns to Free.`,
          'If we change the price of Pro, we will tell you in advance. A new price applies only from your next renewal, and you can cancel before it takes effect.',
        ],
      },
      {
        heading: '8. Refunds',
        blocks: [
          `You can get a full refund within ${REFUND_DAYS} days of a payment, no questions asked. Details and how to ask are in our {refund}.`,
        ],
      },
      {
        heading: '9. Acceptable use',
        blocks: [
          'You agree not to:',
          {
            list: [
              'break the law or infringe the rights of others while using the Service;',
              'try to access other users’ data, or probe, scan or attack our systems;',
              'bypass plan limits, payments or security measures, or resell the Service;',
              'overload the Service with automated requests or use it to send spam or malware.',
            ],
          },
        ],
      },
      {
        heading: '10. Your content',
        blocks: [
          'You own everything you create in Moneo: sessions, tasks, notes and other data. We claim no ownership over it.',
          'You give us only the limited permission needed to store, sync and display your content back to you so we can run the Service. We do not sell your data and do not use it for advertising.',
        ],
      },
      {
        heading: '11. AI features',
        blocks: [
          'Some features suggest plans, steps or answers. They may use on-device rules or an AI model. AI output can be wrong, incomplete or out of date. It is not professional (medical, legal, financial or other) advice. Please review suggestions before you rely on them.',
          'Pro users can connect their own API key for an AI provider (for example Google Gemini, OpenAI or DeepSeek). Your key is stored only in your browser. Requests go directly from your browser to that provider under your own agreement with them. You are responsible for your key, any costs the provider charges, and following the provider’s terms. Avoid sending sensitive personal information to AI features.',
        ],
      },
      {
        heading: '12. Third-party services',
        blocks: [
          'Optional integrations, such as Google sign-in or Google Calendar, are provided by third parties under their own terms. We are not responsible for services we do not control.',
        ],
      },
      {
        heading: '13. Availability and changes to the Service',
        blocks: [
          'We work to keep Moneo available and your data safe, but we cannot promise the Service will always be uninterrupted or error-free. Because data is stored on your device first, clearing your browser data can erase it. Keep your own backups (for example with the Pro export) of anything important.',
          'We may add, change or remove features. If we stop offering Pro altogether, we will refund the unused part of any prepaid subscription.',
        ],
      },
      {
        heading: '14. No warranty',
        blocks: [
          'To the extent the law allows, the Service is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose. Nothing in these Terms limits the rights you have as a consumer under mandatory law.',
        ],
      },
      {
        heading: '15. Limitation of liability',
        blocks: [
          'To the extent the law allows, we are not liable for indirect or consequential losses, such as lost profits, lost data or lost opportunities. Our total liability for any claim relating to the Service is limited to the amount you paid for Moneo in the 12 months before the claim.',
          'These limits do not apply to liability that cannot be limited by law, such as liability for intentional misconduct, gross negligence, or death or personal injury caused by negligence.',
        ],
      },
      {
        heading: '16. Termination',
        blocks: [
          'You can stop using Moneo at any time and delete your account from the Account page.',
          'We may suspend or close an account that seriously or repeatedly breaks these Terms, or where the law requires it. Where reasonable, we will warn you first and give you a chance to export your data. If we close your account without a breach on your part, we will refund the unused part of any prepaid subscription.',
        ],
      },
      {
        heading: '17. Changes to these Terms',
        blocks: [
          'We may update these Terms. If a change is significant, we will tell you in the app or by email before it takes effect. The "Last updated" date above shows the current version. If you keep using the Service after a change takes effect, the new Terms apply; if you do not agree, you can cancel and delete your account.',
        ],
      },
      {
        heading: '18. Governing law',
        blocks: [
          `These Terms are governed by the laws of ${SELLER.country.en}, and disputes will be handled by its competent courts.`,
          'If you are a consumer living in the European Union or the European Economic Area, you also keep the protection of the mandatory consumer laws of your country of residence, and you may bring a claim in the courts of that country.',
        ],
      },
      {
        heading: '19. Contact',
        blocks: [`Questions about these Terms? Write to ${SELLER.name} at {email}.`],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    intro: [
      'This policy explains what personal data Moneo processes, why, who helps us process it, and the choices and rights you have. Moneo is local-first: by default your data stays in your browser on your device.',
    ],
    sections: [
      {
        heading: '1. Who is responsible for your data',
        blocks: [`The data controller is ${OPERATOR}. Contact: {email}.`],
      },
      {
        heading: '2. Data that stays on your device',
        blocks: [
          'Everything you create is first saved in your browser’s local storage on your device: focus sessions, focus areas, settings, projects, tasks, daily plans, time blocks, goals, OKRs, skills, habits, journal and energy entries, assistant chat history and similar data. We cannot see this data. It stays on your device unless you use Pro cloud sync (see below).',
          'If you add your own AI provider API key, it is also stored only in your browser. It is never sent to Moneo’s servers.',
        ],
      },
      {
        heading: '3. Data we process',
        blocks: [
          {
            list: [
              'Account: your email address, a hashed password (if you use one), sign-in method and account timestamps, handled by our authentication provider. If you sign in with Google, we receive your email address and basic profile data from Google.',
              'Profile: your time zone, used to count your days correctly.',
              'Cloud sync (Pro only): focus sessions (duration, time, intention text, focus area), focus areas, your settings, and a random device identifier used to merge changes between devices.',
              'Subscription: plan, status, renewal date and Lemon Squeezy customer and subscription IDs, received from Lemon Squeezy so we know whether you have Pro.',
              'Focus buddy (optional, Pro): if you pair with a buddy, an invite code and the pairing; your buddy can see only your focused minutes for today.',
              'Google Calendar (optional, Pro): if you connect it, a token that lets us read your calendar events (read-only) to show conflicts with your plan. Events are fetched when needed and not stored by us. You can disconnect at any time.',
              'Error reports: if the app crashes, a technical error message and stack trace. Reports are not linked to your account and are not meant to contain your content.',
              'Security data: IP address and request data, processed briefly by our hosting provider and by bot protection on the sign-in form, to protect the Service against abuse.',
              'Messages you send us: your email address and the content of your message.',
            ],
          },
          'Billing data (name, billing address, payment card details) is collected and held by Lemon Squeezy as Merchant of Record, not by Moneo.',
        ],
      },
      {
        heading: '4. AI features',
        blocks: [
          'By default, AI-style plans are built on your device by simple rules, and nothing is sent anywhere.',
          'If you are on Pro and add your own API key for Google Gemini, OpenAI or DeepSeek, the goal you type and your planning details (time horizon, hours per week, level) are sent directly from your browser to that provider. That provider processes them under its own privacy policy, as your service provider, not ours.',
          'If we enable a server-side AI planner, only the goal text (up to 500 characters), the time horizon and hours per week are sent through our server to the AI provider. No sessions, tasks or account details are included.',
          'Voice input in the assistant uses your browser’s built-in speech recognition. Some browsers (for example Chrome) send the audio to the browser maker’s servers to transcribe it.',
        ],
      },
      {
        heading: '5. Why we use your data (legal bases)',
        blocks: [
          'We process personal data under the EU General Data Protection Regulation (GDPR) for users in the EU/EEA, and under the Law of the Republic of Moldova no. 133/2011 on personal data protection (or any law that replaces it).',
          {
            list: [
              'To provide the Service you asked for — account, sync, Pro features and billing status (performance of a contract).',
              'To keep the Service secure and working — bot protection, rate limits and error reports (our legitimate interest in a safe, reliable app).',
              'For optional features you turn on — Google Calendar, focus buddy, your own AI key (your consent, which you can withdraw at any time by turning the feature off).',
              'To comply with legal obligations, for example keeping records when the law requires it.',
            ],
          },
        ],
      },
      {
        heading: '6. Service providers (processors)',
        blocks: [
          'We use these providers to run Moneo. They process data only on our instructions or, where noted, as independent controllers:',
          {
            list: [
              'Supabase — authentication and cloud database (hosted in the EU, Ireland). Also sends sign-in, confirmation and password-reset emails, directly or through an email delivery provider we configure.',
              'Cloudflare — hosting, content delivery, security, and Turnstile bot protection on sign-in forms (global network).',
              'Lemon Squeezy — checkout, payments, taxes, invoices and refunds, as Merchant of Record (an independent controller for billing data; USA).',
              'Google — sign-in with Google and, if you connect it, Google Calendar (USA).',
              'Sentry (Functional Software, Inc.) — error reports (data stored in the EU, Germany).',
              'GitHub (Microsoft) — stores our weekly encrypted database backups (USA).',
              'AI providers you choose yourself (Google Gemini, OpenAI, DeepSeek) — only if you add your own key; and, if we enable server-side AI planning, the AI provider configured on our server.',
            ],
          },
          'We do not sell your personal data, and we do not share it with advertisers or data brokers.',
        ],
      },
      {
        heading: '7. International transfers',
        blocks: [
          'Some providers are located outside your country, including in the United States and, for DeepSeek if you choose it, in China. Where GDPR applies, transfers rely on adequacy decisions (such as the EU–US Data Privacy Framework for certified providers) or the European Commission’s Standard Contractual Clauses.',
        ],
      },
      {
        heading: '8. How long we keep data',
        blocks: [
          {
            list: [
              'Data on your device: until you delete it or clear your browser data.',
              'Account and cloud data: until you delete your account. Deletion removes it from our live database right away; copies in encrypted backups expire within 30 days.',
              'Error reports: up to 90 days.',
              'Security logs at our hosting provider: short periods, typically days.',
              'Support emails: as long as needed to handle your request, and at most 2 years.',
              'Billing records: kept by Lemon Squeezy for as long as tax and accounting laws require.',
            ],
          },
        ],
      },
      {
        heading: '9. Your rights and choices',
        blocks: [
          'You have the right to access, correct, export or delete your personal data, to object to or restrict certain processing, to withdraw consent at any time, and to data portability.',
          {
            list: [
              'Delete data on this device: Settings → "Delete all data on this device".',
              'Delete your account and cloud data: Account → "Delete account". If you have an active subscription, cancel it first in the customer portal.',
              'Export: Pro users can export sessions as CSV/PDF. For any other request, write to {email}.',
              'Stop cloud sync by signing out; your data stays on your device.',
            ],
          },
          'We answer requests within one month. You can also complain to a data protection authority: in the Republic of Moldova, the National Center for Personal Data Protection; in the EU/EEA, the authority of your country of residence.',
        ],
      },
      {
        heading: '10. Cookies and local storage',
        blocks: [
          'Moneo uses no advertising cookies, no analytics and no tracking pixels. We use your browser’s local storage to save your data and your sign-in session, which is strictly necessary for the app to work. Cloudflare and Turnstile may set strictly necessary security cookies to tell people from bots. The Lemon Squeezy checkout, which opens on Lemon Squeezy’s own site, uses its own cookies.',
          'Fonts are served from our own domain; we do not load Google Fonts or other third-party trackers.',
        ],
      },
      {
        heading: '11. Security',
        blocks: [
          'Data travels over encrypted connections (HTTPS/TLS). Cloud data is protected by access rules so that only your account can read it, and database backups are encrypted. Moneo is not end-to-end encrypted, and no system is 100% secure, so please use a strong, unique password.',
        ],
      },
      {
        heading: '12. Children',
        blocks: [
          'Moneo is not directed at children under 16, and we do not knowingly collect their personal data. If you believe a child has given us personal data, contact us and we will delete it.',
        ],
      },
      {
        heading: '13. Changes to this policy',
        blocks: [
          'We may update this policy. If a change is significant, we will tell you in the app or by email. The "Last updated" date above shows the current version.',
        ],
      },
      {
        heading: '14. Contact',
        blocks: [`For privacy questions or requests, write to ${SELLER.name} at {email}.`],
      },
    ],
  },

  refund: {
    title: 'Refund Policy',
    updated: UPDATED,
    intro: [
      `We want you to be happy with Moneo Pro. If you are not, you can get your money back within ${REFUND_DAYS} days — no questions asked.`,
    ],
    sections: [
      {
        heading: `1. ${REFUND_DAYS}-day money-back guarantee`,
        blocks: [
          `You can ask for a full refund of any Pro payment — your first purchase or a renewal, monthly or yearly — within ${REFUND_DAYS} days of the payment date. You do not need to give a reason.`,
        ],
      },
      {
        heading: '2. How to ask for a refund',
        blocks: [
          {
            list: [
              'Email {email} from the address you used at checkout, or include that address and your order number (it is in your Lemon Squeezy receipt email).',
              'Or find your order in your Lemon Squeezy receipt email or at {orders} and ask for a refund there.',
            ],
          },
        ],
      },
      {
        heading: `3. Who processes the refund`,
        blocks: [
          `Payments are handled by ${MOR}, our Merchant of Record. Once we approve your request, ${MOR} returns the money to your original payment method, including any taxes you paid. Refunds usually appear within 5–10 business days, depending on your bank or card issuer.`,
        ],
      },
      {
        heading: '4. What happens to Pro after a refund',
        blocks: [
          'A refund also cancels the subscription, so you will not be charged again. Pro features end when the refund is processed and your account returns to the Free plan.',
          'Your data is not deleted: everything on your device stays there, and data already synced to your account stays in it until you delete your account. Cloud sync is a Pro feature, so it stops.',
        ],
      },
      {
        heading: '5. Cancelling is different from a refund',
        blocks: [
          {
            list: [
              'Cancel: stops future renewals. You keep Pro until the end of the period you already paid for. No money is returned. You can cancel at any time in the customer portal (Account → Manage subscription).',
              `Refund: returns the money for a payment made in the last ${REFUND_DAYS} days and ends Pro right away.`,
            ],
          },
        ],
      },
      {
        heading: `6. After ${REFUND_DAYS} days`,
        blocks: [
          `After ${REFUND_DAYS} days payments are generally not refundable, but you can still cancel at any time to stop future charges. We will always fix billing mistakes, such as a duplicate charge, and we will refund where the law requires it. If we stop offering Pro, we refund the unused part of any prepaid period.`,
          `This policy does not limit any rights you have under mandatory consumer law, including the EU right of withdrawal, which this ${REFUND_DAYS}-day guarantee already covers.`,
        ],
      },
      {
        heading: '7. Contact',
        blocks: [`Questions about billing or refunds? Write to {email}. See also our {terms}.`],
      },
    ],
  },
};
