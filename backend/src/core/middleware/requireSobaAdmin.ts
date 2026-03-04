import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../errors';

/**
 * Guard middleware: requires the actor to be a SOBA platform admin (req.isSobaAdmin === true).
 * Must run after resolveActor so that req.isSobaAdmin is set.
 * Use for admin-only routes (e.g. platform config, cross-workspace operations).
 */
export const requireSobaAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.isSobaAdmin !== true) {
    next(new ForbiddenError('SOBA platform admin required'));
    return;
  }
  next();
};
