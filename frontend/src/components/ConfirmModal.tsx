import { useEffect, useState } from 'react';
import { Btn } from './Btn';
import { FormActions } from './FormActions';
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      disableBackdropClose
    >
      <FormActions flush>
        <Btn
          variant={confirmVariant === 'danger-soft' ? 'danger-soft' : 'primary'}
          disabled={busy}
          onClick={() => void handleConfirm()}
        >
          {confirmLabel}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </Btn>
      </FormActions>
    </Modal>
  );
}
