import type { ReactNode } from 'react';

export function AuditLog({ children }: { children: ReactNode }) {
  return <ul className="audit-log">{children}</ul>;
}

export type AuditLogItemProps = {
  dateTime: string;
  timeLabel: string;
  children: ReactNode;
};

export function AuditLogItem({ dateTime, timeLabel, children }: AuditLogItemProps) {
  return (
    <li className="audit-log-item">
      <time className="audit-log-time" dateTime={dateTime}>
        {timeLabel}
      </time>
      <span className="audit-log-desc">{children}</span>
    </li>
  );
}
