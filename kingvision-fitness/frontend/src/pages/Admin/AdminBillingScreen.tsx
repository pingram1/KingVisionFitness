import React from 'react';
import AdminPlaceholderScreen from './AdminPlaceholderScreen';

export default function AdminBillingScreen() {
  return (
    <AdminPlaceholderScreen
      icon="card-outline"
      title="Billing & Revenue"
      subtitle="Subscription health, Stripe payouts, refunds, and invoice history."
      upcoming={[
        'MRR / ARR + churn dashboard',
        'Per-client subscription state (tier, status, renewal date)',
        'Stripe payout reconciliation and invoice search',
        'One-tap refund and proration adjustments',
      ]}
    />
  );
}
