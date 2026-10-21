// Pure policy checks. Server must fetch trusted records from DB; never accept these as client truth.
export function autopilotEligibility({accountAgeDays, activeSubscription, completedApprovalCycles, unresolvedConsentIssue, unresolvedDeliveryIssue}) {
  const reasons = [];
  if (accountAgeDays < 90) reasons.push('Account has not reached 90 days');
  if (!activeSubscription) reasons.push('Active paid subscription required');
  if (completedApprovalCycles < 2) reasons.push('At least two completed approval cycles required');
  if (unresolvedConsentIssue) reasons.push('Recipient consent issue');
  if (unresolvedDeliveryIssue) reasons.push('Unresolved delivery issue');
  return {eligible: reasons.length === 0, reasons};
}

export function canQueueAutopilot({settings, recipient, message, allocation, now = new Date()}) {
  const reasons = [];
  if (settings.mode !== 'autopilot' || !settings.opted_in_at) reasons.push('Not opted in');
  if (new Date(settings.eligible_at) > now) reasons.push('Not yet eligible');
  if (!recipient.consentValid || recipient.optedOut) reasons.push('Recipient not consented');
  if (!settings.recipient_disclosed_at) reasons.push('Recipient not informed');
  if (settings.profile_revision !== settings.approved_profile_revision) reasons.push('Profile changed');
  if (settings.off_limits_revision !== settings.approved_off_limits_revision) reasons.push('Restrictions changed');
  if (message.profile_revision !== settings.profile_revision || message.off_limits_revision !== settings.off_limits_revision) reasons.push('Message generated using outdated profile');
  if (!message.passesSafetyCheck) reasons.push('Safety check failed');
  if (!allocation.withinPlan || !allocation.withinRelationshipLimit) reasons.push('Plan or recipient allocation exceeded');
  if (!message.withinSchedule) reasons.push('Outside approved delivery schedule');
  if (message.isAutoReply) reasons.push('Autopilot may not reply');
  return {allowed: reasons.length === 0, reasons};
}
