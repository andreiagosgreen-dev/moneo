import { PRO_PRICES } from '../../billing/pricingConfig';
import { DISCOUNT_CODE_VALID_DAYS } from '../../billing/rankDiscount';
import {
  ADULT_AGE,
  DIGITAL_CONSENT_AGE,
  MERCHANT_OF_RECORD,
  MIN_ACCOUNT_AGE,
  REFUND_DAYS,
  SELLER,
  SITE_URL,
  formatLegalDate,
} from '../seller';
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
        heading: '2. Accepting these Terms and who can use Moneo',
        blocks: [
          'By using the Service or creating an account, you agree to these Terms. If you do not agree, please do not use the Service.',
          'Moneo is made for pupils, university students and adults. You can use it without an account: your data then stays on your device and nothing is sent to us. This is the safest option for younger users.',
          {
            list: [
              `To create an account you must be at least ${MIN_ACCOUNT_AGE} years old.`,
              `If you are under ${ADULT_AGE}, you may use Moneo only with the permission of a parent or legal guardian.`,
              `If you are below the age of digital consent in your country (${DIGITAL_CONSENT_AGE} in many EU countries), a parent or legal guardian must agree before you create an account.`,
              `A Pro subscription for someone under ${ADULT_AGE} must be bought by a parent or legal guardian, or with their permission.`,
            ],
          },
          'A parent or legal guardian who allows a minor to use Moneo agrees to these Terms on the minor’s behalf and is responsible for supervising that use. A minor’s ability to enter into agreements is governed by applicable law.',
        ],
      },
      {
        heading: '3. The Service',
        blocks: [
          'Moneo helps you plan your day and run focus sessions. It is local-first: most features work without an account, and your data is stored in your browser on your device.',
          'With an account you can sync focus sessions, focus areas and settings to our cloud database. With Pro, your other planning data (projects, tasks, plans, goals, habits, journal entries and similar) is also saved to your account and synced between your devices. On the Free plan, that planning data stays on your device.',
          'Help, not results: Moneo is a tool that helps you organize your time, plans, habits and goals. We provide the tools and suggestions; what you achieve depends on you. We do not promise any particular outcome — for example better grades, passing an exam, a job, higher income, weight loss or a set level of productivity.',
          'Health and exercise: Move, the workout library and training programs are general information, not medical, physiotherapy or nutrition advice, and they do not replace a doctor or a qualified trainer. Talk to a doctor before you start a new exercise program, especially if you have a health condition, an injury or are pregnant. Stop if you feel pain, dizziness or shortness of breath. You exercise at your own risk, and we do not promise any particular result.',
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
          'Free trial: when a trial is offered on the pricing page, it is available once per account that has never subscribed. You are not charged if you cancel before the trial ends; otherwise the subscription starts and renews at the price shown.',
          `Rank discounts: when an account without Pro reaches certain XP ranks, we may offer a discount code for the first month of Pro monthly. Each code is single-use, valid for ${DISCOUNT_CODE_VALID_DAYS} days, applies only to the first monthly payment, and is limited to one per account. The rank used for this is calculated by us from the activity synced to your account. Discount codes have no cash value, cannot be transferred and are not a right; we may change, pause or end these offers at any time, without affecting a code already issued and still valid.`,
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
          'Pro includes up to 3 AI plans a day, generated through our server with Cloudflare Workers AI. We may adjust this allowance to keep the Service sustainable; when it is used up, or the AI is unavailable, plans are built on your device.',
          'Pro users can also connect their own API key for an AI provider (for example Google Gemini, OpenAI or DeepSeek). Your key is stored only in your browser. Requests go directly from your browser to that provider under your own agreement with them. You are responsible for your key, any costs the provider charges, and following the provider’s terms. Avoid sending sensitive personal information to AI features.',
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
          'We work to keep Moneo available and your data safe, but we cannot promise the Service will always be uninterrupted or error-free. Because data is stored on your device first, clearing your browser data can erase it. Keep your own backups of anything important (for example with the free JSON export in Settings).',
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
          'Everything you create is first saved in your browser’s local storage on your device: focus sessions, focus areas, settings, projects, tasks, daily plans, time blocks, goals, OKRs, skills, habits, journal and energy entries, assistant chat history and similar data. We cannot see this data. It stays on your device unless you turn on cloud sync (see below).',
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
              'Cloud sync (with an account, only after you turn it on): focus sessions (duration, time, intention text, focus area), focus areas, your settings, and a random device identifier used to merge changes between devices.',
              'Full sync (Pro only, when sync is on): your other planning data — projects, tasks, goals, OKRs, habits and habit check-ins, journal and energy entries, life areas and life map, skills, time blocks, daily plans, sprints, board settings, waterfall plans, links, saved filters and roadmaps — together with the time each item was last changed or deleted. Assistant chat history and AI keys are not synced. If Pro ends, the copy already in your account is kept but no longer updated, and your data on the device is not touched.',
              'Subscription: plan, status, renewal date and Lemon Squeezy customer and subscription IDs, received from Lemon Squeezy so we know whether you have Pro.',
              'Focus buddy (optional, Pro): if you pair with a buddy, an invite code and the pairing; your buddy can see only your focused minutes for today.',
              'Google Calendar (optional, Pro): if you connect it, a token that lets us read your calendar events (read-only) to show conflicts with your plan. Events are fetched when needed and not stored by us. You can disconnect at any time.',
              'Error reports: if the app crashes, a technical error message and stack trace. Reports are not linked to your account and are not meant to contain your content.',
              'Security data: IP address and request data, processed briefly by our hosting provider and by bot protection on the sign-in form, to protect the Service against abuse.',
              'Usage statistics: Cloudflare Web Analytics counts page views and measures page performance. It records the page address, referring site, country, and browser and device type, and shows us only aggregated totals. It uses no cookies, does not use your browser storage to track you, and does not identify you or follow you across other sites.',
              'Anonymous product counters: when you reach a few steps in the app (for example finishing the welcome steps, your first focus round, or opening checkout), Moneo counts the step with the chosen plan and the interface language only — no account id, IP address, device id or content — so we can see which parts of Moneo work. We also note the channel that brought you — a campaign label from the link (for example utm_source=tiktok) or the name of the referring site — and keep only that short label in your browser for 30 days, so we can see which channels lead to sign-ups and subscriptions; it does not identify you. Turning on Do Not Track or Global Privacy Control in your browser stops these counters.',
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
          'Included AI plans (Pro): only the goal text (up to 500 characters), the time horizon, hours per week and level are sent through our server to Cloudflare Workers AI. No sessions, tasks, journal or account details are included; the request and the answer are not stored by us, and Cloudflare does not use them to train models. We count only how many plans each account made per day (deleted after two days).',
          'If you are on Pro and add your own API key for Google Gemini, OpenAI or DeepSeek, the goal you type and your planning details (time horizon, hours per week, level) are sent directly from your browser to that provider. That provider processes them under its own privacy policy, as your service provider, not ours.',
          'Voice input in the assistant uses your browser’s built-in speech recognition. Some browsers (for example Chrome) send the audio to the browser maker’s servers to transcribe it.',
        ],
      },
      {
        heading: '5. Why we use your data (legal bases)',
        blocks: [
          'We process personal data under the EU General Data Protection Regulation (GDPR) for users in the EU/EEA, and under Law of the Republic of Moldova no. 195/2024 on personal data protection, in force since 23 August 2026 (it replaced Law no. 133/2011).',
          {
            list: [
              'To provide the Service you asked for — account, sync, Pro features and billing status (performance of a contract).',
              'To keep the Service secure and working — bot protection, rate limits and error reports (our legitimate interest in a safe, reliable app).',
              'To understand, in aggregate, which pages are used and how fast they load — cookieless Cloudflare Web Analytics (our legitimate interest in improving the Service).',
              'For optional features you turn on — Google Calendar, focus buddy, your own AI key (your consent, which you can withdraw at any time by turning the feature off).',
              'To comply with legal obligations, for example keeping records when the law requires it.',
              'To send you a welcome email after you create an account and, if you have not used Moneo for a week, one reminder. Each has a one-click unsubscribe link (our legitimate interest in helping you get started; you can object at any time).',
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
              'Cloudflare — hosting, content delivery, security, Turnstile bot protection on sign-in forms, and cookieless Web Analytics (global network).',
              'Lemon Squeezy — checkout, payments, taxes, invoices and refunds, as Merchant of Record (an independent controller for billing data; USA).',
              'Google — sign-in with Google and, if you connect it, Google Calendar (USA).',
              'Sentry (Functional Software, Inc.) — error reports (data stored in the EU, Germany).',
              'GitHub (Microsoft) — stores our weekly encrypted database backups (USA).',
              'AI providers you choose yourself (Google Gemini, OpenAI, DeepSeek) — only if you add your own key.',
              'Resend — sends Moneo’s emails: sign-in, confirmation and password-reset emails, and the welcome and reminder emails (USA).',
              'Cloudflare Workers AI — generates the included AI plans on Pro (receives only the goal text and plan settings; nothing is stored).',
            ],
          },
          'We do not sell your personal data, and we do not share it with advertisers or data brokers.',
        ],
      },
      {
        heading: '7. International transfers',
        blocks: [
          'Some providers are located outside your country, including in the United States and, for DeepSeek if you choose it, in China. Where GDPR applies, transfers rely on adequacy decisions (such as the EU–US Data Privacy Framework for certified providers) or the European Commission’s Standard Contractual Clauses.',
          'For users in the Republic of Moldova, the same safeguards are used for transfers under Law no. 195/2024.',
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
              'Usage statistics: kept by Cloudflare only as aggregated totals that do not identify you.',
              'Security logs at our hosting provider: short periods, typically days.',
              'Support emails: as long as needed to handle your request, and at most 2 years.',
              'Billing records: kept by Lemon Squeezy for as long as tax and accounting laws require.',
              'Anonymous product counters (by step, plan, language and channel): up to 3 months, then deleted automatically.',
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
              'Access and portability: in Settings, anyone can export all their Moneo data as a JSON file, free of charge, and import it again on another device. Pro adds extra report formats (CSV/PDF). For any other request, write to {email}.',
              'Stop cloud sync by signing out; your data stays on your device.',
            ],
          },
          'We answer requests within one month. You can also complain to a data protection authority: in the Republic of Moldova, the National Center for Personal Data Protection; in the EU/EEA, the authority of your country of residence.',
        ],
      },
      {
        heading: '10. Cookies and local storage',
        blocks: [
          'Moneo uses no advertising cookies, no advertising trackers, no tracking pixels and no cross-site tracking. For usage statistics we use Cloudflare Web Analytics, which is cookieless and does not store anything in your browser to recognize you. We use your browser’s local storage to save your data and your sign-in session, which is strictly necessary for the app to work. Cloudflare and Turnstile may set strictly necessary security cookies to tell people from bots. The Lemon Squeezy checkout, which opens on Lemon Squeezy’s own site, uses its own cookies.',
          'Fonts are served from our own domain; we do not load Google Fonts or other third-party trackers.',
        ],
      },
      {
        heading: '11. Security',
        blocks: [
          'Data travels over encrypted connections (HTTPS/TLS). Cloud data is protected by access rules so that only your account can read it, and database backups are encrypted. Moneo is not end-to-end encrypted, and no system is 100% secure, so please use a strong, unique password.',
          'If a security incident puts personal data at risk, we notify the competent authority — in the Republic of Moldova, the National Center for Personal Data Protection — within 72 hours of becoming aware of it, and we tell affected users without undue delay when the risk to them is high. We keep an internal record of processing activities and of any incidents.',
        ],
      },
      {
        heading: '12. Children and students',
        blocks: [
          `Moneo is used by pupils, university students and adults. An account requires a minimum age of ${MIN_ACCOUNT_AGE}. Users under ${ADULT_AGE} need the permission of a parent or legal guardian, and below the age of digital consent in their country (${DIGITAL_CONSENT_AGE} in many EU countries) a parent or legal guardian must consent to the account being created.`,
          {
            list: [
              'Without an account, nothing is sent to us: all data stays on the device. This is the safest way for younger users to use Moneo.',
              'With an account, we collect the same minimal data from minors as from anyone else (see section 3) — nothing extra.',
              'No advertising, no profiling and no selling of data — for anyone, including minors.',
              'Parents and legal guardians can ask to see, export or delete their child’s data by writing to {email}.',
              `If we learn that a child under ${MIN_ACCOUNT_AGE} has created an account, we delete the account and its data.`,
            ],
          },
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
          'Your data is not deleted: everything on your device stays there, and data already synced to your account stays in it until you delete your account. Full sync of all your data is a Pro feature, so it stops updating; focus sessions, focus areas and settings keep syncing.',
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
