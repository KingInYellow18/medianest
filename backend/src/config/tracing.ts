import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import { logger } from '../utils/logger';

import type {
  TracingSDK,
  ResourceAttributes,
  AutoInstrumentationConfig,
  IncomingHttpRequest,
  TracingSpan,
  HttpInstrumentationResponse,
} from '../types/opentelemetry';
import type { Sampler } from '@opentelemetry/api';
import type { SpanExporter, SamplingResult } from '@opentelemetry/sdk-trace-base';

// Environment configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'observe-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const TRACING_ENABLED = process.env.TRACING_ENABLED !== 'false';

// Resource configuration
const resourceAttributes: ResourceAttributes = {};
resourceAttributes[SemanticResourceAttributes.SERVICE_NAME] = SERVICE_NAME;
resourceAttributes[SemanticResourceAttributes.SERVICE_VERSION] = SERVICE_VERSION;
resourceAttributes[SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT] = ENVIRONMENT;
resourceAttributes[SemanticResourceAttributes.SERVICE_INSTANCE_ID] =
  process.env.HOSTNAME || 'unknown';

// Use require to avoid TypeScript import issues temporarily
const ResourceClass = require('@opentelemetry/resources').Resource;

const resource = ResourceClass.default().merge(new ResourceClass(resourceAttributes));

// Jaeger exporter configuration
const jaegerExporter = new JaegerExporter({
  endpoint: JAEGER_ENDPOINT,
  tags: [
    { key: 'service.name', value: SERVICE_NAME },
    { key: 'service.version', value: SERVICE_VERSION },
    { key: 'environment', value: ENVIRONMENT },
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
const instrumentationConfig: AutoInstrumentationConfig = {
  // Disable automatic filesystem instrumentation to reduce noise
  '@opentelemetry/instrumentation-fs': {
    enabled: false,
  },
  // Configure HTTP instrumentation
  '@opentelemetry/instrumentation-http': {
    enabled: true,
    ignoreIncomingRequestHook: (req: IncomingHttpRequest) => {
      // Ignore health checks and static assets
      const url = req.url || '';
      return url.includes('/health') || url.includes('/favicon.ico') || url.includes('/static/');
    },
    requestHook: (span: TracingSpan, request: any) => {
      span.setAttributes({
        'http.request.header.user-agent': (request.getHeader('user-agent') as string) || '',
        'http.request.header.x-correlation-id':
          (request.getHeader('x-correlation-id') as string) || '',
      });
    },
    responseHook: (span: TracingSpan, response: HttpInstrumentationResponse) => {
      span.setAttributes({
        'http.response.size': Number(response.getHeader('content-length')) || 0,
      });
    },
  },
  // Configure Express instrumentation
  '@opentelemetry/instrumentation-express': {
    enabled: true,
    ignoreLayers: [
      // Ignore certain middleware layers
      (name: string) => name === 'cors',
      (name: string) => name === 'helmet',
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
};

const instrumentations = [getNodeAutoInstrumentations(instrumentationConfig as any)];

// Sampling configuration
const samplingConfig = {
  // Sample 100% in development, 10% in production
  ratio: ENVIRONMENT === 'development' ? 1.0 : 0.1,
};

// Initialize SDK
let sdk: TracingSDK | null = null;

if (TRACING_ENABLED) {
  const sampler: Sampler = {
    shouldSample: (): SamplingResult => ({
      decision:
        Math.random() < samplingConfig.ratio
          ? SamplingDecision.RECORD_AND_SAMPLED
          : SamplingDecision.NOT_RECORD,
      attributes: Object.freeze({}),
      traceState: undefined,
    }),
    toString: () => `CustomSampler{ratio: ${samplingConfig.ratio}}`,
  };

  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(
      (ENVIRONMENT === 'development' ? jaegerExporter : otlpExporter) as SpanExporter,
      {
        maxExportBatchSize: 100,
        maxQueueSize: 1000,
        exportTimeoutMillis: 30000,
        scheduledDelayMillis: 5000,
      },
    ),
    instrumentations,
    sampler: sampler as Sampler,
  }) as unknown as TracingSDK;

  // Start tracing
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => logger.info('Distributed tracing terminated', { service: SERVICE_NAME }))
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error terminating tracing', { error: errorMessage, service: SERVICE_NAME });
      })
      .finally(() => process.exit(0));
  });

  logger.info('Distributed tracing initialized', {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    jaegerEndpoint: JAEGER_ENDPOINT,
    samplingRatio: samplingConfig.ratio,
    timestamp: new Date().toISOString(),
  });
} else {
  logger.info('Distributed tracing is disabled', {
    reason: 'TRACING_ENABLED environment variable is not set to true',
    timestamp: new Date().toISOString(),
  });
}

// Export utilities for manual instrumentation
export { sdk };
// @ts-ignore
export * from '@opentelemetry/api';
