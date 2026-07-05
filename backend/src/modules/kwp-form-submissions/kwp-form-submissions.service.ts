import { kwpFormSubmissionsRepository } from './kwp-form-submissions.repository';
import type {
  CreatedKwpFormSubmissionDTO,
  ChangeKwpFormWorkflowStatusDTO,
  CreateKwp01SubmissionDTO,
  CreateKwp02SubmissionDTO,
  CreateKwp03SubmissionDTO,
  CreateKwp04SubmissionDTO,
  CreateKwp05SubmissionDTO,
  KwpFormSubmissionAccess,
  KwpFormSubmissionDetailDTO,
  KwpFormSubmissionReadAccess,
  KwpFormSubmissionUpdateAccess,
  KwpFormWorkflowAccess,
  KwpFormWorkflowDTO,
  ResubmitKwpFormSubmissionDTO,
} from './kwp-form-submissions.types';

export const kwpFormSubmissionsService = {
  getWorkflow(id: number, access: KwpFormWorkflowAccess): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.getWorkflow(id, access);
  },

  changeWorkflowStatus(
    id: number,
    input: ChangeKwpFormWorkflowStatusDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.changeWorkflowStatus(id, input, access);
  },

  getById(id: number, access: KwpFormSubmissionReadAccess): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.getById(id, access);
  },

  updateKwp01(
    id: number,
    payload: CreateKwp01SubmissionDTO,
    access: Omit<KwpFormSubmissionUpdateAccess, 'formType'>,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.updateKwp01(id, payload, {
      ...access,
      formType: 'KWP01',
    });
  },

  updateKwp02(
    id: number,
    payload: CreateKwp02SubmissionDTO,
    access: Omit<KwpFormSubmissionUpdateAccess, 'formType'>,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.updateKwp02(id, payload, {
      ...access,
      formType: 'KWP02',
    });
  },

  updateKwp03(
    id: number,
    payload: CreateKwp03SubmissionDTO,
    access: Omit<KwpFormSubmissionUpdateAccess, 'formType'>,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.updateKwp03(id, payload, {
      ...access,
      formType: 'KWP03',
    });
  },

  updateKwp04(
    id: number,
    payload: CreateKwp04SubmissionDTO,
    access: Omit<KwpFormSubmissionUpdateAccess, 'formType'>,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.updateKwp04(id, payload, {
      ...access,
      formType: 'KWP04',
    });
  },

  updateKwp05(
    id: number,
    payload: CreateKwp05SubmissionDTO,
    access: Omit<KwpFormSubmissionUpdateAccess, 'formType'>,
  ): Promise<KwpFormSubmissionDetailDTO> {
    return kwpFormSubmissionsRepository.updateKwp05(id, payload, {
      ...access,
      formType: 'KWP05',
    });
  },

  resubmitKwp01(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.resubmit(id, input, { ...access, formType: 'KWP01' });
  },

  resubmitKwp02(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.resubmit(id, input, { ...access, formType: 'KWP02' });
  },

  resubmitKwp03(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.resubmit(id, input, { ...access, formType: 'KWP03' });
  },

  resubmitKwp04(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.resubmit(id, input, { ...access, formType: 'KWP04' });
  },

  resubmitKwp05(
    id: number,
    input: ResubmitKwpFormSubmissionDTO,
    access: KwpFormWorkflowAccess,
  ): Promise<KwpFormWorkflowDTO> {
    return kwpFormSubmissionsRepository.resubmit(id, input, { ...access, formType: 'KWP05' });
  },

  createKwp01(
    payload: CreateKwp01SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp01(payload, access);
  },

  createKwp02(
    payload: CreateKwp02SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp02(payload, access);
  },

  createKwp03(
    payload: CreateKwp03SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp03(payload, access);
  },

  createKwp04(
    payload: CreateKwp04SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp04(payload, access);
  },

  createKwp05(
    payload: CreateKwp05SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp05(payload, access);
  },
};
