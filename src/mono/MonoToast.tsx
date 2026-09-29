interface Props {
  message: string | null;
  /** Optional inline action (e.g. Undo); makes the toast clickable. */
  action?: { label: string; onClick: () => void } | null;
}

/** Mono toast (V1 prototype). Visible while `message` is non-null. */
export default function MonoToast({ message, action }: Props) {
  const withAction = Boolean(message && action);
  return (
    <div
      className={`mono-toast${message ? ' show' : ''}${withAction ? ' has-action' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message ?? ''}
      {withAction && action ? (
        <button type="button" className="mono-toast-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
