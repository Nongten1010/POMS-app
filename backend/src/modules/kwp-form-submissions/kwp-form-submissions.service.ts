import { kwpFormSubmissionsRepository } from './kwp-form-submissions.repository';
import type {
  CreatedKwpFormSubmissionDTO,
  CreateKwp01SubmissionDTO,
  CreateKwp02SubmissionDTO,
  CreateKwp04SubmissionDTO,
  KwpFormSubmissionAccess,
  KwpFormSubmissionDetailDTO,
  KwpFormSubmissionReadAccess,
} from './kwp-form-submissions.types';

export const kwpFormSubmissionsService = {
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

  createKwp04(
    payload: CreateKwp04SubmissionDTO,
    access: KwpFormSubmissionAccess,
  ): Promise<CreatedKwpFormSubmissionDTO> {
    return kwpFormSubmissionsRepository.createKwp04(payload, access);
  },
};
