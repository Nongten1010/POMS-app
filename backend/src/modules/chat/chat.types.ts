import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import type { AuthenticatedUser } from '../../shared/types/express';

export const CHAT_TOPICS = [
  { code: 'factory_access', label: 'ข้อมูลโรงงานและสิทธิ์การใช้งาน' },
  { code: 'connection_data', label: 'การขอเชื่อมต่อและการส่งข้อมูล' },
  { code: 'measurements_alerts', label: 'ผลตรวจวัดและการแจ้งเตือน' },
  { code: 'forms_reports', label: 'แบบฟอร์มและการยื่นรายงาน' },
  { code: 'form_legal_guidance', label: 'ข้อมูลในแบบฟอร์ม กฎหมายและประกาศฯ' },
  { code: 'other', label: 'อื่นๆ' },
] as const;
export type ChatTopicCode = (typeof CHAT_TOPICS)[number]['code'];
export type ChatStatus = 'open' | 'closed';
export type ChatPointReference = { kind: 'eligible' | 'connected'; id: number } | null;
export interface ChatAccess {
  actorUserId: number;
  userType: AuthenticatedUser['userType'];
  roles: string[];
  factoryScope: PermissionScopeDetails | undefined;
  createScope: PermissionScopeDetails | undefined;
  answerScope: PermissionScopeDetails | undefined;
  regionalAccess: RegionalAccessDTO | null;
  canCreateTicket: boolean;
  canWrite: boolean;
}
export interface ChatActor {
  userId: number;
  name: string;
  roleCode: string;
  roleLabel: string;
}
export interface ChatFactory {
  id: number;
  name: string;
  registrationNo: string;
  provinceName: string;
  regionName: string | null;
}
export interface ChatMeasurementPoint {
  kind: 'eligible' | 'connected';
  id: number;
  systemType: 'CEMS' | 'WPMS';
  pointCode: string | null;
  pointName: string;
}
export interface ChatMessage {
  id: number;
  ticketId: number;
  text: string;
  sender: ChatActor;
  createdAt: string;
}
export interface ChatEvent {
  id: number;
  type: 'opened' | 'closed';
  actor: ChatActor;
  createdAt: string;
}
export interface ChatTicketSummary {
  id: number;
  ticketNo: string;
  topic: { code: ChatTopicCode; label: string };
  factory: ChatFactory;
  measurementPoint: ChatMeasurementPoint | null;
  status: ChatStatus;
  openedBy: ChatActor;
  openedAt: string;
  closedBy: ChatActor | null;
  closedAt: string | null;
  lastMessageAt: string;
  lastMessageSenderType: 'operator' | 'officer';
  capabilities: { canReply: boolean; canClose: boolean };
}
export interface ChatTicketDetail extends ChatTicketSummary {
  events: ChatEvent[];
}
export interface ChatPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface ChatPage<T> {
  data: T[];
  pagination: ChatPagination;
}
export interface ChatFactoryQuery {
  page: number;
  pageSize: number;
  q?: string;
}
export interface ChatTicketQuery extends ChatFactoryQuery {
  status?: ChatStatus;
  topicCode?: ChatTopicCode;
  eligibleFactoryId?: number;
  regionName?: string;
  provinceName?: string;
  from?: string;
  to?: string;
  sort:
    | 'lastMessageAt'
    | 'ticketNo'
    | 'topic'
    | 'factoryName'
    | 'registrationNo'
    | 'regionName'
    | 'provinceName'
    | 'status';
  order: 'asc' | 'desc';
}
export interface ChatMessageQuery {
  limit: number;
  olderCursor?: string;
  afterMessageId?: number;
}
export interface ChatMessagePage {
  ticket: ChatTicketDetail;
  messages: ChatMessage[];
  pagination: { olderCursor: string | null; nextAfterMessageId: number | null; hasMore: boolean };
}
export interface CreateChatTicket {
  eligibleFactoryId: number;
  measurementPoint: ChatPointReference;
  topicCode: ChatTopicCode;
  message: string;
}
export interface CreateChatResult {
  ticket: ChatTicketDetail;
  firstMessage: ChatMessage;
  replayed: boolean;
}
export interface SendChatResult {
  ticket: ChatTicketDetail;
  message: ChatMessage;
  replayed: boolean;
}
