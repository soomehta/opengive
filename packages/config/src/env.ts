import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),

  // Railway ML Service
  ML_API_URL: z.string().url().optional(),
  ML_API_SECRET: z.string().optional(),

  // External APIs
  UK_CHARITY_COMMISSION_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Maps
  NEXT_PUBLIC_MAPLIBRE_STYLE_URL: z
    .string()
    .url()
    .optional()
    .default('https://demotiles.maplibre.org/style.json'),

  // Feature Flags
  FEATURE_AI_ANALYSIS: z.coerce.boolean().default(false),
  FEATURE_INVESTIGATION_WORKBENCH: z.coerce.boolean().default(false),
  FEATURE_PUBLIC_API: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

// Validate at import time — fail fast
function createEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      'Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

// Lazy singleton — only validates when first accessed
let _env: Env | undefined;
export function getEnv(): Env {
  if (!_env) {
    _env = createEnv();
  }
  return _env;
}

// Re-export schema for use in other validation contexts
export { envSchema };
