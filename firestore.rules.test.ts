/**
 * Firestore Security Rules Test Suite — "Dirty Dozen" Verification
 */
export interface TestPayloadResult {
  id: number;
  name: string;
  expectedDecision: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: TestPayloadResult[] = [
  { id: 1, name: 'Rejects shadow field injection on Appointment create', expectedDecision: 'PERMISSION_DENIED' },
  { id: 2, name: 'Rejects identity spoofing where clientUid != request.auth.uid', expectedDecision: 'PERMISSION_DENIED' },
  { id: 3, name: 'Rejects admin email with email_verified == false', expectedDecision: 'PERMISSION_DENIED' },
  { id: 4, name: 'Rejects PII read on Appointment by non-owner non-admin', expectedDecision: 'PERMISSION_DENIED' },
  { id: 5, name: 'Rejects unfiltered list query on Appointments by non-admin', expectedDecision: 'PERMISSION_DENIED' },
  { id: 6, name: 'Rejects Appointment creation for non-existent serviceId', expectedDecision: 'PERMISSION_DENIED' },
  { id: 7, name: 'Rejects Appointment creation with initial status Confirmed', expectedDecision: 'PERMISSION_DENIED' },
  { id: 8, name: 'Rejects client update on Completed or Cancelled Appointment', expectedDecision: 'PERMISSION_DENIED' },
  { id: 9, name: 'Rejects mutation of immutable fields (clientUid, serviceId, createdAt)', expectedDecision: 'PERMISSION_DENIED' },
  { id: 10, name: 'Rejects forged client timestamps not matching request.time', expectedDecision: 'PERMISSION_DENIED' },
  { id: 11, name: 'Rejects oversized message string > 600 chars on Inquiry', expectedDecision: 'PERMISSION_DENIED' },
  { id: 12, name: 'Rejects malformed or >128 char document IDs', expectedDecision: 'PERMISSION_DENIED' },
];
