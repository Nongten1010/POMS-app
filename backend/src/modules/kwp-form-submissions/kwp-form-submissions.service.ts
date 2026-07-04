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
  KwpFormWorkflowAccess,
  KwpFormWorkflowDTO,
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
