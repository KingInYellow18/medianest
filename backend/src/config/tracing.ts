import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

// Environment configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'observe-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const TRACING_ENABLED = process.env.TRACING_ENABLED !== 'false';

// Resource configuration
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
  })
);

// Jaeger exporter configuration
const jaegerExporter = new JaegerExporter({
  endpoint: JAEGER_ENDPOINT,
  tags: [
    { key: 'service.name', value: SERVICE_NAME },
    { key: 'service.version', value: SERVICE_VERSION },
    { key: 'environment', value: ENVIRONMENT }
  ],
});

// OTLP exporter configuration (alternative to Jaeger)
const otlpExporter = new OTLPTraceExporter({
  url: OTLP_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Custom instrumentation configuration
const instrumentations = [
  getNodeAutoInstrumentations({
    // Disable automatic filesystem instrumentation to reduce noise
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    // Configure HTTP instrumentation
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      ignoreIncomingRequestHook: (req) => {
        // Ignore health checks and static assets
        const url = req.url || '';
        return url.includes('/health') || 
               url.includes('/favicon.ico') || 
               url.includes('/static/');
      },
      requestHook: (span, request) => {
        span.setAttributes({
          'http.request.header.user-agent': request.getHeader('user-agent') || '',
          'http.request.header.x-correlation-id': request.getHeader('x-correlation-id') || '',
        });
      },
      responseHook: (span, response) => {
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
        (name) => name === 'cors',
        (name) => name === 'helmet',
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
let sdk: NodeSDK | null = null;

if (TRACING_ENABLED) {
  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(
      ENVIRONMENT === 'development' ? jaegerExporter : otlpExporter,
      {
        maxExportBatchSize: 100,
        maxQueueSize: 1000,
        exportTimeoutMillis: 30000,
        scheduledDelayMillis: 5000,
      }
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
    sdk?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
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
export * from '@opentelemetry/api';