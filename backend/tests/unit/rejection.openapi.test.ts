import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value as JsonObject;
const schemas = object(object(pomsOpenApiDocument.components).schemas);
const operation = (path: string): JsonObject =>
  object(object(object(pomsOpenApiDocument.paths)[path]).post);

describe('rejection public OpenAPI contract', () => {
  it('accepts both optional notes in KWP status history responses', () => {
    const history = object(schemas.KwpFormStatusHistoryRow);
    expect(object(object(history.properties).note)).toMatchObject({
      type: 'string',
      nullable: true,
      maxLength: 2001,
    });
  });

  it('allows rejecting a basic-information edit request without a reason or source-status restriction', () => {
    const request = object(schemas.PomsFactoryEditReviewRequest);
    const properties = object(request.properties);
    expect(object(properties.decision).enum).toContain('REJECT');
    expect(request.required).toEqual(['decision']);
    expect(object(properties.officerNote)).toMatchObject({
      type: 'string',
      nullable: true,
      maxLength: 1000,
    });
    expect(object(properties.officerNote)).not.toHaveProperty('minLength');
    const review = operation('/poms-factories/edit-requests/{id}/review');
    expect(review.description).toContain('REJECT ได้ทุกสถานะ');
    expect(review.description).toContain('ไม่บังคับเหตุผล');
    expect(review.description).toContain('JWT role admin');
  });

  it('publishes KWP rejection with optional reasons and exposes it to authorized approvers in every status', () => {
    const branches = object(schemas.KwpWorkflowActionRequest).oneOf as JsonObject[];
    const reject = branches.find((branch) =>
      (object(object(branch.properties).action).enum as string[]).includes('REJECT'),
    );
    expect(reject).toBeDefined();
    expect(reject?.required).toEqual(['action']);
    const properties = object(reject?.properties);
    for (const name of ['officerNote', 'revisionReason']) {
      expect(object(properties[name])).toMatchObject({
        type: 'string',
        nullable: true,
        maxLength: 1000,
      });
      expect(object(properties[name])).not.toHaveProperty('minLength');
    }
    const workflow = object(object(object(schemas.KwpWorkflowResponse).properties).data);
    const allowedActions = object(object(workflow.properties).allowedActions);
    expect(object(allowedActions.items).enum).toContain('REJECT');
    expect(allowedActions.description).toContain('ทุกสถานะ');
    const action = operation('/kwp-form-submissions/{id}/workflow-actions');
    expect(action.description).toContain('REJECT ได้ทุกสถานะ');
    expect(action.description).toContain('ไม่บังคับเหตุผล');
    expect(action.description).toContain('kwp_forms:approve');
  });

  it('publishes BOD/COD rejection independently of the current status or pending step', () => {
    const branches = object(schemas.BodCodWorkflowActionRequest).oneOf as JsonObject[];
    const reject = branches.find((branch) =>
      (object(object(branch.properties).action).enum as string[]).includes('REJECT'),
    );
    expect(reject?.required).toEqual(['action']);
    expect(object(object(reject?.properties).officerNote)).toMatchObject({
      nullable: true,
      maxLength: 1000,
    });
    const action = operation('/bod-cod-deviation-reports/{id}/workflow-actions');
    expect(action.description).toContain('REJECT ได้ทุกสถานะ');
    expect(action.description).toContain('ไม่ต้องมี current step');
    expect(action.description).toContain('ไม่บังคับเหตุผล');
    expect(action.description).toContain('OWN_FACTORY');
    const allowedActions = object(
      object(object(schemas.BodCodReportData).properties).allowedActions,
    );
    expect(allowedActions.description).toContain('REJECT');
    expect(allowedActions.description).toContain('ทุกสถานะ');
  });

  it('provides copyable rejection examples that require only the decision or action', () => {
    for (const [path, example] of [
      ['/poms-factories/edit-requests/{id}/review', { decision: 'REJECT' }],
      ['/kwp-form-submissions/{id}/workflow-actions', { action: 'REJECT' }],
      ['/bod-cod-deviation-reports/{id}/workflow-actions', { action: 'REJECT' }],
    ] as const) {
      const action = operation(path);
      const media = object(object(object(action.requestBody).content)['application/json']);
      expect(media.example).toEqual(example);
      expect(object(object(action.responses)['200']).description).toContain('REJECTED');
    }
  });
});
