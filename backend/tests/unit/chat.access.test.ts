import { describe, expect, it } from '@jest/globals';
import { getChatAccess, requireChatWrite } from '../../src/modules/chat/chat.access';
import type { AuthenticatedUser } from '../../src/shared/types/express';
import type { PermissionScopeDetails } from '../../src/modules/auth/permissions';

const officer: AuthenticatedUser = {
  id: 201,
  userType: 'officer',
  roles: ['diw_central'],
  scopes: { 'chat:view': 'ALL', 'chat:ask': 'ALL', 'chat:answer': 'ALL' },
};

describe('Chat current permission access', () => {
  it('requires authentication and an explicit Chat view grant', () => {
    expect(() => getChatAccess(undefined)).toThrow('Authentication required');
    expect(() => getChatAccess({ ...officer, scopes: { 'chat:ask': 'ALL' } })).toThrow(
      'Chat view permission required',
    );
  });

  it('resolves Chat view, ask and answer independently of eligible-factory scope', () => {
    const access = getChatAccess({
      ...officer,
      scopes: { ...officer.scopes, 'eligible_factories:view': 'ALL' },
      scopeDetails: {
        'chat:view': { scope: 'IN_PROVINCE', province: 'ระยอง' },
        'chat:ask': { scope: 'IN_REGION', region: 'ภาคกลาง' },
        'chat:answer': { scope: 'OWN_FACTORY' },
        'eligible_factories:view': { scope: 'ALL' },
      },
    });
    expect(access).toMatchObject({
      factoryScope: { scope: 'IN_PROVINCE', province: 'ระยอง' },
      createScope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
      answerScope: { scope: 'OWN_FACTORY' },
      canCreateTicket: true,
      canWrite: true,
    });
  });

  it.each(['operator', 'officer', 'admin'] as const)(
    'allows %s creation with a valid ask grant and keeps answer-only access separate',
    (userType) => {
      const asker = getChatAccess({
        ...officer,
        userType,
        scopes: { 'chat:view': 'ALL', 'chat:ask': 'ALL' },
      });
      expect(asker.canCreateTicket).toBe(true);
      expect(asker.canWrite).toBe(true);
      expect(asker.answerScope).toBeUndefined();
      const answerer = getChatAccess({
        ...officer,
        userType,
        scopes: { 'chat:view': 'ALL', 'chat:answer': 'ALL' },
      });
      expect(answerer.canCreateTicket).toBe(false);
      expect(answerer.canWrite).toBe(true);
      expect(() => requireChatWrite(answerer, true)).toThrow('Chat ask permission required');
    },
  );

  it.each([
    { scope: null },
    { scope: 'IN_PROVINCE' },
    { scope: 'IN_PROVINCE', province: '   ' },
    { scope: 'IN_REGION' },
    { scope: 'IN_REGION', region: '   ' },
    { scope: 'IN_ESTATE' },
    { scope: 'IN_ESTATE', estateCode: '   ' },
  ] satisfies PermissionScopeDetails[])(
    'fails closed for an unresolved view or action scope %j',
    (invalid) => {
      const noView = getChatAccess({
        ...officer,
        scopeDetails: { 'chat:view': invalid },
      });
      expect(noView.canCreateTicket).toBe(false);
      expect(noView.canWrite).toBe(false);
      const noAction = getChatAccess({
        ...officer,
        scopeDetails: { 'chat:ask': invalid, 'chat:answer': invalid },
      });
      expect(noAction.canCreateTicket).toBe(false);
      expect(noAction.canWrite).toBe(false);
      expect(() => requireChatWrite(noAction)).toThrow('Chat write permission required');
    },
  );

  it('does not trust orphan scope details for a grant removed from current permissions', () => {
    const access = getChatAccess({
      ...officer,
      scopes: { 'chat:view': 'ALL' },
      scopeDetails: {
        'chat:ask': { scope: 'ALL' },
        'chat:answer': { scope: 'ALL' },
      },
    });
    expect(access).toMatchObject({ canCreateTicket: false, canWrite: false });
    expect(access.createScope).toBeUndefined();
    expect(access.answerScope).toBeUndefined();
  });

  it('uses the assigned regional profile when IN_REGION has no explicit region', () => {
    const access = getChatAccess({
      ...officer,
      scopes: { 'chat:view': 'IN_REGION', 'chat:ask': 'IN_REGION' },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });
    expect(access).toMatchObject({ canCreateTicket: true, canWrite: true });
  });

  it.each([{ userType: 'citizen' as const }, { roles: [] }])(
    'denies writes for an ineligible persona %j despite current scoped grants',
    (change) => {
      expect(getChatAccess({ ...officer, ...change })).toMatchObject({
        canCreateTicket: false,
        canWrite: false,
      });
    },
  );
});
