import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const database = process.env.DB_DATABASE || 'cocos';
  const ssl = process.env.DB_SSL === 'true';

  // Build connection URL with sslmode parameter (more reliable for Neon and AWS RDS)
  const sslMode = ssl ? 'require' : 'disable';
  const url = `postgresql://${username}:${password}@${host}:${port}/${database}?sslmode=${sslMode}`;

  return {
    url,
    synchronize: false, // Always false — external DB, never auto-sync
    logging: process.env.DB_LOGGING === 'true',
  };
});
