import { Router } from 'express';
import { parameterValuesController } from './parameter-values.controller';

export const parameterValuesRoutes = Router();

parameterValuesRoutes.get('/tables', parameterValuesController.listTables);
parameterValuesRoutes.get('/latest', parameterValuesController.latest);
parameterValuesRoutes.get('/', parameterValuesController.list);
