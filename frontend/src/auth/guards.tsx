import React from 'react';

export type Role = 'analyst' | 'field_analyst' | 'approver' | 'admin';

interface RoleGuardProps {
  currentRole: Role;
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  currentRole,
  allowedRoles,
  children,
  fallback = (
    <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-sm">
      <span className="font-semibold">Access Restricted:</span> Your active role (<code>{currentRole}</code>) does not have permission to view or execute this action.
    </div>
  ),
}) => {
  if (!allowedRoles.includes(currentRole)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

export const ApproverOnlyGuard: React.FC<{ currentRole: Role; children: React.ReactNode }> = ({
  currentRole,
  children,
}) => (
  <RoleGuard
    currentRole={currentRole}
    allowedRoles={['approver']}
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-md text-sm">
        <span className="font-semibold">Sign-Off Authorization Required:</span> Only an authenticated Incident Lead Approver may authorize or reject relief plans.
      </div>
    }
  >
    {children}
  </RoleGuard>
);

