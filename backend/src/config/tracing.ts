// @ts-ignore
import { NodeSDK } from '@opentelemetry/sdk-node';
// @ts-ignore
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// @ts-ignore
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
// @ts-ignore
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
// @ts-ignore
import { Resource } from '@opentelemetry/resources';
// @ts-ignore
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// @ts-ignore
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
// @ts-ignore
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
// @ts-ignore
import { registerInstrumentations } from '@opentelemetry/instrumentation';
// @ts-ignore
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
// @ts-ignore
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

// Environment configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'observe-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const TRACING_ENABLED = process.env.TRACING_ENABLED !== 'false';

// Resource configuration
const resourceAttributes: any = {};
resourceAttributes[(SemanticResourceAttributes as any).SERVICE_NAME] = SERVICE_NAME;
resourceAttributes[(SemanticResourceAttributes as any).SERVICE_VERSION] = SERVICE_VERSION;
resourceAttributes[(SemanticResourceAttributes as any).DEPLOYMENT_ENVIRONMENT] = ENVIRONMENT;
resourceAttributes[(SemanticResourceAttributes as any).SERVICE_INSTANCE_ID] =
  process.env.HOSTNAME || 'unknown';

// Use require to avoid TypeScript import issues temporarily
const ResourceClass = require('@opentelemetry/resources').Resource;
const resource = ResourceClass.default().merge(new ResourceClass(resourceAttributes));

// Jaeger exporter configuration
const jaegerExporter = new (JaegerExporter as any)({
  endpoint: JAEGER_ENDPOINT,
  tags: [
    { key: 'service.name', value: SERVICE_NAME },
    { key: 'service.version', value: SERVICE_VERSION },
    { key: 'environment', value: ENVIRONMENT },
  ],
});

// OTLP exporter configuration (alternative to Jaeger)
const otlpExporter = new (OTLPTraceExporter as any)({
  url: OTLP_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Custom instrumentation configuration
const instrumentations = [
  (getNodeAutoInstrumentations as any)({
    // Disable automatic filesystem instrumentation to reduce noise
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    // Configure HTTP instrumentation
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      ignoreIncomingRequestHook: (req: any) => {
        // Ignore health checks and static assets
        const url = req.url || '';
        return url.includes('/health') || url.includes('/favicon.ico') || url.includes('/static/');
      },
      requestHook: (span: any, request: any) => {
        span.setAttributes({
          'http.request.header.user-agent': request.getHeader('user-agent') || '',
          'http.request.header.x-correlation-id': request.getHeader('x-correlation-id') || '',
        });
      },
      responseHook: (span: any, response: any) => {
        span.setAttributes({
          'http.response.size': response.getHeader('content-length') || 0,
        });
      },
    },
    // Configure Express instrumentation
    '@opentelemetry/instrumentation-express': {
      enabled: true,
      ignoreLayers: [
        // Ignore certain middleware layers
        (name: any) => name === 'cors',
        (name: any) => name === 'helmet',
      ],
    },
    // Configure Prisma instrumentation
    '@opentelemetry/instrumentation-prisma': {
      enabled: true,
    },
    // Configure Redis instrumentation
    '@opentelemetry/instrumentation-redis': {
      enabled: true,
    },
  }),
];

// Sampling configuration
const samplingConfig = {
  // Sample 100% in development, 10% in production
  ratio: ENVIRONMENT === 'development' ? 1.0 : 0.1,
};

// Initialize SDK
let sdk: any | null = null;

if (TRACING_ENABLED) {
  sdk = new (NodeSDK as any)({
    resource,
    spanProcessor: new (BatchSpanProcessor as any)(
      ENVIRONMENT === 'development' ? jaegerExporter : otlpExporter,
      {
        maxExportBatchSize: 100,
        maxQueueSize: 1000,
        exportTimeoutMillis: 30000,
        scheduledDelayMillis: 5000,
      },
    ),
    instrumentations,
    sampler: {
      shouldSample: () => ({
        decision: Math.random() < samplingConfig.ratio ? 1 : 0, // SamplingDecision.RECORD_AND_SAMPLE : SamplingDecision.NOT_RECORD
        attributes: {},
        traceState: undefined,
      }),
      toString: () => `CustomSampler{ratio: ${samplingConfig.ratio}}`,
    } as any,
  });

  // Start tracing
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error: any) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });

  console.log(`🔍 Distributed tracing initialized for ${SERVICE_NAME} v${SERVICE_VERSION}`);
  console.log(`📊 Jaeger endpoint: ${JAEGER_ENDPOINT}`);
  console.log(`🎯 Sampling ratio: ${samplingConfig.ratio * 100}%`);
} else {
  console.log('⚠️  Distributed tracing is disabled');
}

// Export utilities for manual instrumentation
export { sdk };
// @ts-ignore
export * from '@opentelemetry/api';
