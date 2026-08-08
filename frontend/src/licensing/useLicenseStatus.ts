import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export type LicenseStatusDto = {
  status: 'demo' | 'full' | 'blocked' | 'pending_activation';
  reason: string | null;
  remainingSeconds: number | null;
  hwid: string;
  /** Код для поставщика; есть, когда ключ введён. */
  requestCode: string | null;
  productVersion: string;
};

const LICENSE_INACTIVE_EVENT = 'license-inactive';

export function useLicenseStatus() {
  const [data, setData] = useState<LicenseStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const next = await api<LicenseStatusDto>('/license/status');
      setData(next);
      setError(null);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка статуса лицензии');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    const onInactive = () => {
      void refetch();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(LICENSE_INACTIVE_EVENT, onInactive);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(LICENSE_INACTIVE_EVENT, onInactive);
    };
  }, [refetch]);

  useEffect(() => {
    if (!data || data.status !== 'demo' || data.remainingSeconds == null) return;
    if (data.remainingSeconds > 0) {
      const t = window.setTimeout(() => void refetch(), Math.min(data.remainingSeconds, 60) * 1000);
      return () => window.clearTimeout(t);
    }
    void refetch();
  }, [data, refetch]);

  return {
    status: data?.status ?? null,
    reason: data?.reason ?? null,
    remainingSeconds: data?.remainingSeconds ?? null,
    hwid: data?.hwid ?? '',
    requestCode: data?.requestCode ?? null,
    productVersion: data?.productVersion ?? '',
    loading,
    error,
    refetch,
    data,
  };
}

export { LICENSE_INACTIVE_EVENT };
