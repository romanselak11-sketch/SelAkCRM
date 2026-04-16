import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { PolicyForm } from '../components/PolicyForm';

export function PolicyFormPage() {
  const { taskId } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const initialClientId = sp.get('client') ?? undefined;

  return (
    <Modal
      open
      title={taskId ? 'Продление полиса' : 'Новый полис'}
      size="lg"
      onClose={() => nav(-1)}
    >
      <PolicyForm
        key={`${taskId ?? 'new'}-${initialClientId ?? ''}`}
        taskId={taskId}
        initialClientId={initialClientId}
        onSuccess={() => nav('/')}
        onCancel={() => nav(-1)}
      />
    </Modal>
  );
}
