import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LEMON_MY_ORDERS_URL } from '../../lib/billing/lemonSqueezy';
import {
  LEGAL_PATHS,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  type LegalDocId,
} from '../../lib/legal/seller';
import { splitTokens } from '../../lib/legal/tokens';

interface Props {
  text: string;
  /** Link labels for `{terms}`, `{privacy}` and `{refund}` in the text's language. */
  docLabels: Record<LegalDocId, string>;
  linkClassName?: string;
}

/** Renders `{email}`, `{terms}`, `{privacy}`, `{refund}` and `{orders}` as links. */
export default function LegalInline({ text, docLabels, linkClassName }: Props) {
  const nodes: ReactNode[] = splitTokens(text).map((part, i) => {
    if (part.kind === 'text') return <Fragment key={i}>{part.text}</Fragment>;
    const name = part.name;
    if (name === 'email') {
      return (
        <a key={i} href={SUPPORT_MAILTO} className={linkClassName}>
          {SUPPORT_EMAIL}
        </a>
      );
    }
    if (name === 'orders') {
      return (
        <a
          key={i}
          href={LEMON_MY_ORDERS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {LEMON_MY_ORDERS_URL.replace(/^https:\/\//, '')}
        </a>
      );
    }
    return (
      <Link key={i} to={LEGAL_PATHS[name]} className={linkClassName}>
        {docLabels[name]}
      </Link>
    );
  });

  return <>{nodes}</>;
}
