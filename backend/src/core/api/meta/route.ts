import express from 'express';
import {
  getBuildMeta,
  getCodesBySetMeta,
  getCodesMeta,
  getFeaturesMeta,
  getFormEnginesMeta,
  getPluginsMeta,
} from './controller';

const router = express.Router();

router.get('/plugins', getPluginsMeta);
router.get('/features', getFeaturesMeta);
router.get('/form-engines', getFormEnginesMeta);
router.get('/build', getBuildMeta);
router.get('/codes', getCodesMeta);
router.get('/codes/:codeSet', getCodesBySetMeta);

export { router as metaRouter };
