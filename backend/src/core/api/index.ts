import express from 'express';
import { coreContextMiddleware } from '../middleware/requestContext';
import { requireCoreContext } from '../middleware/requireCoreContext';
import { coreErrorHandler } from '../middleware/errorHandler';
import { formsDomain } from './forms';
import { metaDomain } from './meta';
import { submissionsDomain } from './submissions';
import { registerOpenApiPaths } from './shared/openapi';

// Meta is mounted at app level at /api/v1/meta and is public (no JWT, no core context).
// Only forms and submissions are mounted on this router; metaDomain is included here for OpenAPI registration only.
const coreDomains = [formsDomain, metaDomain, submissionsDomain];

const router = express.Router();
registerOpenApiPaths((registry) => {
  for (const domain of coreDomains) {
    domain.registerOpenApi(registry);
  }
});

router.use(coreContextMiddleware);
router.use(requireCoreContext);
const authenticatedDomains = [formsDomain, submissionsDomain];
for (const domain of authenticatedDomains) {
  router.use(domain.path, domain.router);
}
router.use(coreErrorHandler);

export { router as coreRouter };
