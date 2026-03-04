import pinoHttp from 'pino-http';
import rTracer from 'cls-rtracer';
import { v7 as uuidv7 } from 'uuid';
import { log } from './logger';

export const httpLogger = pinoHttp({
  logger: log,
  autoLogging: true,
  customLogLevel(_req, res, err) {
    if (err != null || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  genReqId(req, res): string {
    const clsRequestId = rTracer.id();
    const normalizedClsRequestId = clsRequestId != null ? String(clsRequestId) : undefined;
    const headerRequestId = req.headers['x-request-id'];
    const existingHeaderId = Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId;
    const existingReqId = typeof req.id === 'string' ? req.id : undefined;
    const requestId: string =
      normalizedClsRequestId ?? existingReqId ?? existingHeaderId ?? uuidv7();

    req.id = requestId;
    if (res.getHeader('X-Request-Id') == null) {
      res.setHeader('X-Request-Id', requestId);
    }

    return requestId;
  },
  customProps(req) {
    return {
      requestId:
        (rTracer.id() as string | undefined) ?? (typeof req.id === 'string' ? req.id : undefined),
    };
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.socket?.remoteAddress,
        headers: req.headers,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
        headers: typeof res.getHeaders === 'function' ? res.getHeaders() : undefined,
      };
    },
    err(err) {
      return {
        type: err.name,
        message: err.message,
        stack: err.stack,
      };
    },
  },
});
