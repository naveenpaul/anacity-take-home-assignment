/**
 * Action types the POC supports. Each maps to the permission key required
 * to perform it. Adding a new action type means adding one row here and
 * (if it's a new permission) seeding the Permission row + including it on
 * the relevant role templates.
 */
export const ACTION_TYPE_PERMISSIONS: Record<string, string> = {
  visitor_approved: 'approve_visitor',
  maintenance_raised: 'raise_maintenance',
  notice_created: 'create_notice',
  parking_assigned: 'manage_units',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  visitor_approved: 'Approved a visitor',
  maintenance_raised: 'Raised a maintenance ticket',
  notice_created: 'Posted a notice',
  parking_assigned: 'Assigned parking',
};

export function permissionFor(actionType: string): string | undefined {
  return ACTION_TYPE_PERMISSIONS[actionType];
}

export function knownActionTypes(): string[] {
  return Object.keys(ACTION_TYPE_PERMISSIONS);
}
