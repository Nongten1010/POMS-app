export const OFFICER_NOTIFICATION_RECIPIENT_TYPES = ['PROVINCE', 'INDUSTRIAL_ESTATE'] as const;

export type OfficerNotificationRecipientType =
  (typeof OFFICER_NOTIFICATION_RECIPIENT_TYPES)[number];

export interface CreateOfficerNotificationEmailRecipientInput {
  recipientType: OfficerNotificationRecipientType;
  provinceName?: string | null;
  emails: string[];
}

export interface OfficerNotificationEmailRecipientDTO {
  id: number;
  recipientType: OfficerNotificationRecipientType;
  provinceName: string | null;
  emails: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
