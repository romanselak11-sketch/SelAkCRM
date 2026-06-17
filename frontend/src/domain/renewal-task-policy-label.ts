export type RenewalTaskPolicySummary = {
  number: string;
  companyName: string;
  productName: string;
};

export function formatRenewalPolicyLabel(policy: RenewalTaskPolicySummary): string {
  return `${policy.number} · ${policy.companyName} / ${policy.productName}`;
}
