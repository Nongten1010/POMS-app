import { kwpFormSubmissionsRepository } from './kwp-form-submissions.repository';
import type {
  CreatedKwpFormSubmissionDTO,
  CreateKwp01SubmissionDTO,
  CreateKwp02SubmissionDTO,
  KwpFormSubmissionAccess,
} from './kwp-form-submissions.types';

export const kwpFormSubmissionsService = {
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
};
