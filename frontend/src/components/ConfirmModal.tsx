import { useEffect, useState } from 'react';
import { Modal } from './Modal';

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger-soft';
  onConfirm: () => void | Promise<void>;
};

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  confirmVariant = 'primary',
  onConfirm,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  const confirmClass =
    confirmVariant === 'danger-soft' ? 'btn btn--danger-soft' : 'btn btn--primary';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      disableBackdropClose
    >
      <div className="form-actions" style={{ marginTop: 0 }}>
        <button type="button" className={confirmClass} disabled={busy} onClick={() => void handleConfirm()}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
