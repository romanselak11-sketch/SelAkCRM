type FieldRejectBubbleProps = {
  message: string;
  visible: boolean;
  id?: string;
};

export function FieldRejectBubble({ message, visible, id }: FieldRejectBubbleProps) {
  if (!visible || !message) return null;
  return (
    <div
      id={id}
      className="field-reject-bubble"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
