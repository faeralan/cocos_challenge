import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE || 'Cocos Challenge API',
  description:
    process.env.SWAGGER_DESCRIPTION || 'Backend API for Cocos Challenge',
  version: process.env.SWAGGER_VERSION || '1.0',
  path: process.env.SWAGGER_PATH || 'docs',
  enabled: process.env.SWAGGER_ENABLED !== 'false',
}));
