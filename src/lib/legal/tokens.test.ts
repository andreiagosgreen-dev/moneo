import { describe, expect, it } from 'vitest';
import { splitTokens } from './tokens';

describe('splitTokens', () => {
  it('splits known tokens and keeps the surrounding text', () => {
    expect(splitTokens('Agree to the {terms} and the {privacy}.')).toEqual([
      { kind: 'text', text: 'Agree to the ' },
      { kind: 'token', name: 'terms' },
      { kind: 'text', text: ' and the ' },
      { kind: 'token', name: 'privacy' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('handles tokens at the edges and leaves unknown names as text', () => {
    expect(splitTokens('{email}')).toEqual([{ kind: 'token', name: 'email' }]);
    expect(splitTokens('{n} days — {refund}')).toEqual([
      { kind: 'text', text: '{n} days — ' },
      { kind: 'token', name: 'refund' },
    ]);
  });

  it('honours a restricted token list', () => {
    expect(splitTokens('{terms} {email}', ['email'])).toEqual([
      { kind: 'text', text: '{terms} ' },
      { kind: 'token', name: 'email' },
    ]);
  });
});
