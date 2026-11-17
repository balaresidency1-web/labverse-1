/**
 * Only an activated MVIT staff profile may access the live staff portal.
 * An invited profile is not active until the invitation/password flow completes.
 */
export function isActiveStaffStatus(status: string | null | undefined): boolean {
  return status === 'active';
}
