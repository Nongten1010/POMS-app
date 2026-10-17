import { Router, type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../shared/middlewares/authenticate';
import { getChatAccess, requireChatWrite } from './chat.access';
import { chatRepository } from './chat.repository';
import { CHAT_TOPICS } from './chat.types';
import {
  chatFactoryQuerySchema,
  chatIdSchema,
  chatIdempotencyKeySchema,
  createChatTicketSchema,
  sendChatMessageSchema,
  closeChatTicketSchema,
  chatTicketQuerySchema,
  chatMessageQuerySchema,
} from './chat.validator';
import { listChatFactories, listChatMeasurementPoints } from './chat-factories.repository';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

export function createChatRoutes(): Router {
  const chatRoutes = Router();
  chatRoutes.use(authenticate);
  chatRoutes.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    getChatAccess(req.user);
    next();
  });
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    keyGenerator: (req) => `chat-user:${getChatAccess(req.user).actorUserId}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many chat write requests' },
    },
  });
  chatRoutes.use((req, res, next) =>
    req.method === 'POST' ? writeLimiter(req, res, next) : next(),
  );
  chatRoutes.get('/options', async (req, res) => {
    const access = getChatAccess(req.user);
    const viewer = await chatRepository.getActor(access);
    res.json({
      success: true,
      data: {
        viewer,
        topics: CHAT_TOPICS,
        limits: { messageMaxLength: 2000 },
        canCreate: access.canCreateTicket,
      },
    });
  });
  chatRoutes.post('/tickets', async (req, res) => {
    const access = getChatAccess(req.user);
    requireChatWrite(access, true);
    const input = createChatTicketSchema.parse(req.body);
    const key = chatIdempotencyKeySchema.parse(req.get('Idempotency-Key'));
    const data = await chatRepository.createTicket(access, input, key);
    res
      .location(`${req.baseUrl}/tickets/${data.ticket.id}`)
      .status(data.replayed ? 200 : 201)
      .json({ success: true, data });
  });
  chatRoutes.get('/factories', async (req, res) => {
    const result = await listChatFactories(
      getChatAccess(req.user),
      chatFactoryQuerySchema.parse(req.query),
    );
    res.json({ success: true, ...result });
  });
  chatRoutes.get('/factories/:id/measurement-points', async (req, res) => {
    const data = await listChatMeasurementPoints(
      getChatAccess(req.user),
      chatIdSchema.parse(req.params.id),
    );
    res.json({ success: true, data });
  });
  chatRoutes.get('/tickets/:id', async (req, res) => {
    const data = await chatRepository.getTicket(
      getChatAccess(req.user),
      chatIdSchema.parse(req.params.id),
    );
    if (!data) throw new NotFoundError('Ticket not found');
    res.json({ success: true, data });
  });
  chatRoutes.get('/tickets', async (req, res) => {
    const result = await chatRepository.listTickets(
      getChatAccess(req.user),
      chatTicketQuerySchema.parse(req.query),
    );
    res.json({ success: true, ...result });
  });
  chatRoutes.post('/tickets/:id/messages', async (req, res) => {
    const access = getChatAccess(req.user);
    requireChatWrite(access);
    const id = chatIdSchema.parse(req.params.id);
    const { message } = sendChatMessageSchema.parse(req.body);
    const key = chatIdempotencyKeySchema.parse(req.get('Idempotency-Key'));
    const data = await chatRepository.sendMessage(access, id, message, key);
    res.status(data.replayed ? 200 : 201).json({ success: true, data });
  });
  chatRoutes.post('/tickets/:id/close', async (req, res) => {
    const access = getChatAccess(req.user);
    requireChatWrite(access);
    closeChatTicketSchema.parse(req.body ?? {});
    const data = await chatRepository.closeTicket(access, chatIdSchema.parse(req.params.id));
    res.json({ success: true, data });
  });
  chatRoutes.get('/tickets/:id/messages', async (req, res) => {
    const data = await chatRepository.getMessages(
      getChatAccess(req.user),
      chatIdSchema.parse(req.params.id),
      chatMessageQuerySchema.parse(req.query),
    );
    res.json({ success: true, data });
  });

  return chatRoutes;
}

// Mounted at app level so body-parser failures before this router are sanitized too.
// Knex errors can include SQL bindings; never forward message bodies or keys to the shared logger.
export const chatErrorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (error instanceof AppError || error instanceof ZodError) return next(error);
  const type = error && typeof error === 'object' && 'type' in error ? error.type : undefined;
  if (type === 'entity.parse.failed')
    return next(new AppError('Invalid JSON body', 400, 'BAD_REQUEST'));
  if (type === 'entity.too.large')
    return next(new AppError('Request body exceeds 1 MB', 413, 'PAYLOAD_TOO_LARGE'));
  return next(new AppError('Chat request could not be completed', 500, 'INTERNAL_ERROR'));
};
