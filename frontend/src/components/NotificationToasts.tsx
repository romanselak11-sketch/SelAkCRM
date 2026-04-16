/** Временные уведомления (тосты) поверх страницы. */
export function NotificationToasts({ items }: { items: { id: string; message: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div key={item.id} className="toast" role="status">
          {item.message}
        </div>
      ))}
    </div>
  );
}
