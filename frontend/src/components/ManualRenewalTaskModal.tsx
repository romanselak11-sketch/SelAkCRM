import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { PolicyForm } from './PolicyForm';
import { Modal } from './Modal';
import { FieldLabel } from './FieldLabel';
import { Stack } from './Stack';
import { ScrollableChoiceList } from './ScrollableChoiceList';
import { Btn } from './Btn';
import { FormActions, FormError } from './FormActions';

type PolicyPick = {
  id: string;
  number: string;
  endDate: string;
  clientLabel: string;
  companyName: string;
  productName: string;
};

type ManualRenewalTaskModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type Mode = 'new' | 'existing';

export function ManualRenewalTaskModal({ open, onClose, onCreated }: ManualRenewalTaskModalProps) {
  const [mode, setMode] = useState<Mode>('new');
  const [policySearch, setPolicySearch] = useState('');
  const [policyOptions, setPolicyOptions] = useState<PolicyPick[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [policyLoadErr, setPolicyLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('new');
    setPolicySearch('');
    setPolicyOptions([]);
    setPolicyId('');
    setPolicyLoadErr(null);
    setSubmitErr(null);
    setBusy(false);
  }, [open]);

  const loadPolicies = useCallback(async (q: string) => {
    setPolicyLoadErr(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      qs.set('limit', '30');
      const rows = await api<PolicyPick[]>(`/home/policy-form/policies?${qs.toString()}`);
      setPolicyOptions(rows);
    } catch {
      setPolicyLoadErr('Не удалось загрузить список полисов');
      setPolicyOptions([]);
    }
  }, []);

  useEffect(() => {
    if (!open || mode !== 'existing') return;
    const timer = window.setTimeout(() => {
      void loadPolicies(policySearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, mode, policySearch, loadPolicies]);

  const existingPolicyChoices = useMemo(
    () =>
      policyOptions.map((p) => ({
        value: p.id,
        label: `${p.number} · ${p.clientLabel} · ${p.companyName} / ${p.productName}`,
      })),
    [policyOptions],
  );

  async function submitExisting() {
    setSubmitErr(null);
    if (!policyId) {
      setSubmitErr('Выберите полис');
      return;
    }
    setBusy(true);
    try {
      await api('/home/tasks', {
        method: 'POST',
        body: JSON.stringify({ policyId }),
      });
      onCreated();
      onClose();
    } catch (ex) {
      setSubmitErr(
        ex instanceof ApiError
          ? ex.message
          : 'Не удалось создать задачу. Возможно, у полиса уже есть активная задача.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Новая задача продления" size="lg">
      <div className="manual-task-modal">
        <Stack
          direction="row"
          gap={2}
          wrap
          className="manual-task-modal__mode"
          role="tablist"
          aria-label="Способ создания"
        >
          <Btn
            role="tab"
            aria-selected={mode === 'new'}
            variant="ghost"
            size="sm"
            pill
            softActive={mode === 'new'}
            onClick={() => setMode('new')}
          >
            Новый полис
          </Btn>
          <Btn
            role="tab"
            aria-selected={mode === 'existing'}
            variant="ghost"
            size="sm"
            pill
            softActive={mode === 'existing'}
            onClick={() => setMode('existing')}
          >
            Существующий полис
          </Btn>
        </Stack>

        {mode === 'new' ? (
          <PolicyForm
            key="manual-new-policy"
            createManualTask
            onSuccess={() => {
              onCreated();
              onClose();
            }}
            onCancel={onClose}
          />
        ) : (
          <div className="manual-task-modal__existing form-grid">
            <label className="field">
              <FieldLabel hint="Номер полиса или ФИО">Поиск полиса</FieldLabel>
              <input
                type="search"
                value={policySearch}
                onChange={(e) => setPolicySearch(e.target.value)}
                placeholder="Номер полиса или ФИО клиента"
                autoComplete="off"
              />
            </label>
            <div className="field">
              <FieldLabel hint="Полис для задачи продления">Полис</FieldLabel>
              <ScrollableChoiceList
                value={policyId}
                onChange={setPolicyId}
                options={existingPolicyChoices}
                placeholder="Выберите полис"
                searchable
                searchPlaceholder="Уточните поиск выше"
                emptySearchText="Полисы не найдены"
              />
            </div>
            <FormError>{policyLoadErr}</FormError>
            <FormError>{submitErr}</FormError>
            <FormActions>
              <Btn variant="primary" disabled={busy} onClick={() => void submitExisting()}>
                Создать задачу
              </Btn>
              <Btn variant="ghost" onClick={onClose} disabled={busy}>
                Отмена
              </Btn>
            </FormActions>
          </div>
        )}
      </div>
    </Modal>
  );
}
