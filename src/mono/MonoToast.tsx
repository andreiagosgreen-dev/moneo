interface Props {
  message: string | null;
}

/** Mono toast (V1 prototype). Visible while `message` is non-null. */
export default function MonoToast({ message }: Props) {
  return (
    <div className={`mono-toast${message ? ' show' : ''}`} role="status" aria-live="polite">
      {message ?? ''}
    </div>
  );
}
