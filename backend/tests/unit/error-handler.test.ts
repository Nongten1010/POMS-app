import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from '@jest/globals';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';

describe('errorHandler validation response', () => {
  it('keeps legacy field errors and exposes full nested issue paths', async () => {
    const app = express();
    app.use(express.json());
    app.post('/validate', (req, res, next) => {
      try {
        const data = z
          .object({
            measurementPoints: z.array(
              z.object({
                details: z.object({
                  exemptedParameterRegulationClauses: z.array(z.string()),
                }),
              }),
            ),
          })
          .parse(req.body);
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    });
    app.use(errorHandler);

    const response = await request(app)
      .post('/validate')
      .send({
        measurementPoints: [
          {
            details: {
              exemptedParameterRegulationClauses: [7],
            },
          },
        ],
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: {
          measurementPoints: expect.any(Array),
        },
        issues: [
          {
            code: 'invalid_type',
            path: ['measurementPoints', 0, 'details', 'exemptedParameterRegulationClauses', 0],
            pathString: 'measurementPoints.0.details.exemptedParameterRegulationClauses.0',
            message: expect.any(String),
          },
        ],
      },
    });
  });
});
