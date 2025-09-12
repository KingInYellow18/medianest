import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

import { CatchError } from '../types/common';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: CatchError) {
      // Error will be caught by error middleware
      next(error);
    }
  };
};
