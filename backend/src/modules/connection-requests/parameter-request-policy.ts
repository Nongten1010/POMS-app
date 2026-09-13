export interface ParameterRequestActorContext {
  actorUserId: number;
  userType: 'citizen' | 'operator' | 'officer' | 'admin';
  roles: string[];
}

// Match the actors supported by the officer add-measurement-point form.
export function canOmitParameterRequestSections(
  actor: Pick<ParameterRequestActorContext, 'userType' | 'roles'> | null,
): boolean {
  return (
    actor !== null &&
    (actor.userType === 'officer' || actor.userType === 'admin') &&
    (actor.roles.includes('monitoring_kpm') || actor.roles.includes('admin'))
  );
}
