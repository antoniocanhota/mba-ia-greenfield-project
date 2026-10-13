import { envValidationSchema } from './env.validation';

const requiredEnv = {
  DB_USERNAME: 'user',
  DB_PASSWORD: 'pass',
  DB_NAME: 'db',
  JWT_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  S3_ENDPOINT: 'http://storage:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'videos',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  REDIS_HOST: 'redis',
};

const validateWithout = (key: keyof typeof requiredEnv) => {
  const env: Record<string, string | undefined> = { ...requiredEnv };
  delete env[key];
  return envValidationSchema.validate(env, {
    allowUnknown: true,
    abortEarly: false,
  });
};

interface ValidationOutcome {
  value: Record<string, unknown>;
  error?: Error;
}

const validate = (env: Record<string, string>): ValidationOutcome =>
  envValidationSchema.validate(
    { ...requiredEnv, ...env },
    { allowUnknown: true, abortEarly: false },
  ) as ValidationOutcome;

describe('envValidationSchema — SWAGGER_ENABLED', () => {
  it('should reject SWAGGER_ENABLED with an invalid value', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'invalid' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('SWAGGER_ENABLED');
  });

  it('should accept SWAGGER_ENABLED=true', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'true' });
    expect(error).toBeUndefined();
  });

  it('should accept SWAGGER_ENABLED=false', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'false' });
    expect(error).toBeUndefined();
  });

  it('should apply default false when SWAGGER_ENABLED is not set', () => {
    const { value, error } = validate({});
    expect(error).toBeUndefined();
    expect(value.SWAGGER_ENABLED).toBe('false');
  });
});

describe('envValidationSchema — storage and queue', () => {
  it.each([
    'S3_ENDPOINT',
    'S3_PUBLIC_ENDPOINT',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'REDIS_HOST',
  ] as const)('should reject a missing %s', (key) => {
    const { error } = validateWithout(key);
    expect(error).toBeDefined();
    expect(error!.message).toContain(key);
  });

  it('should apply defaults for S3_REGION, REDIS_PORT and the TTLs', () => {
    const { value, error } = validate({});
    expect(error).toBeUndefined();
    expect(value.S3_REGION).toBe('us-east-1');
    expect(value.REDIS_PORT).toBe(6379);
    expect(value.UPLOAD_SIGN_TTL_SECONDS).toBe(3600);
    expect(value.VIDEO_URL_TTL_SECONDS).toBe(14400);
  });

  it('should keep explicitly provided values over the defaults', () => {
    const { value, error } = validate({
      S3_REGION: 'sa-east-1',
      REDIS_PORT: '6380',
      UPLOAD_SIGN_TTL_SECONDS: '60',
      VIDEO_URL_TTL_SECONDS: '120',
    });
    expect(error).toBeUndefined();
    expect(value.S3_REGION).toBe('sa-east-1');
    expect(value.REDIS_PORT).toBe(6380);
    expect(value.UPLOAD_SIGN_TTL_SECONDS).toBe(60);
    expect(value.VIDEO_URL_TTL_SECONDS).toBe(120);
  });
});
