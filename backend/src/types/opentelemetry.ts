/**
 * OpenTelemetry type definitions to replace 'any' types in tracing
 * Fixed to align with actual OpenTelemetry API types
 */
import type {
  Span,
  SpanKind,
  SpanStatusCode,
  Attributes,
  AttributeValue,
  Context,
  Link,
  TraceState,
} from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import type { Sampler, SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-base';

// Core OpenTelemetry types - properly aligned with @opentelemetry/api
export interface TracingSpan extends Span {
  // These methods return 'this' in the actual API, not Span
  setAttributes(attributes: Attributes): this;
  setAttribute(key: string, value: AttributeValue): this;
  setStatus(status: SpanStatus): this;
  updateName(name: string): this;
  end(endTime?: number): void;
}

// Use OpenTelemetry's actual types instead of redefining
export type SpanAttributes = Attributes;
// AttributeValue is already imported and will be re-exported below

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

// HTTP instrumentation types
export interface HttpInstrumentationConfig {
  enabled: boolean;
  ignoreIncomingRequestHook?: (request: IncomingHttpRequest) => boolean;
  ignoreOutgoingRequestHook?: (request: OutgoingHttpRequest) => boolean;
  requestHook?: (span: TracingSpan, request: IncomingHttpRequest | OutgoingHttpRequest) => void;
  responseHook?: (span: TracingSpan, response: HttpInstrumentationResponse) => void;
  startIncomingSpanHook?: (request: IncomingHttpRequest) => Attributes;
  startOutgoingSpanHook?: (request: OutgoingHttpRequest) => Attributes;
}

export interface IncomingHttpRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
  protocol?: string;
  path?: string;
  query?: Record<string, string | string[]>;
  socket?: {
    remoteAddress?: string;
    remotePort?: number;
  };
  getHeader(name: string): string | string[] | undefined;
}

export interface OutgoingHttpRequest {
  method?: string;
  protocol?: string;
  hostname?: string;
  port?: number;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
  getHeader?(name: string): string | string[] | undefined;
  setHeader?(name: string, value: string | string[]): void;
}

export interface HttpInstrumentationResponse {
  statusCode?: number;
  statusMessage?: string;
  headers?: Record<string, string | string[] | undefined>;
  getHeader(name: string): string | string[] | number | undefined;
  getHeaders?(): Record<string, string | string[] | undefined>;
}

// Express instrumentation types
export interface ExpressInstrumentationConfig {
  enabled: boolean;
  ignoreIncomingRequestHook?: (request: IncomingHttpRequest) => boolean;
  requestHook?: (span: TracingSpan, info: ExpressRequestInfo) => void;
  ignoreLayers?: Array<ExpressLayerType | ((name: string, type: ExpressLayerType) => boolean)>;
}

export interface ExpressRequestInfo {
  request: IncomingHttpRequest;
  route?: string;
  layerName?: string;
  layerType?: ExpressLayerType;
}

export type ExpressLayerType = 'router' | 'middleware' | 'request_handler';

// Resource configuration types - align with OpenTelemetry Resource interface
export interface ResourceAttributes extends Attributes {
  'service.name'?: string;
  'service.version'?: string;
  'service.instance.id'?: string;
  'deployment.environment'?: string;
}

// Don't extend Resource - create a separate interface to avoid conflicts
export interface TracingResourceConfig {
  attributes: ResourceAttributes;
  schemaUrl?: string;
}

// Helper type for resource creation
export type ResourceOptions = {
  attributes: ResourceAttributes;
  schemaUrl?: string;
};

// Exporter configuration types
export interface JaegerExporterConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  tags?: Array<{ key: string; value: string }>;
}

export interface OTLPTraceExporterConfig {
  url?: string;
  headers?: Record<string, string>;
  keepAlive?: boolean;
  compression?: 'gzip' | 'none';
  timeout?: number;
  concurrencyLimit?: number;
}

// Sampling types - align with actual OpenTelemetry Sampler interface
export interface TracingSampler extends Sampler {
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult;
  toString(): string;
}

export interface CustomSamplingResult extends SamplingResult {
  decision: SamplingDecision;
  attributes?: Readonly<Attributes>;
  traceState?: TraceState;
}

// Instrumentation configuration types
export interface AutoInstrumentationConfig {
  '@opentelemetry/instrumentation-http'?: HttpInstrumentationConfig;
  '@opentelemetry/instrumentation-express'?: ExpressInstrumentationConfig;
  '@opentelemetry/instrumentation-fs'?: {
    enabled: boolean;
  };
  '@opentelemetry/instrumentation-dns'?: {
    enabled: boolean;
  };
  '@opentelemetry/instrumentation-net'?: {
    enabled: boolean;
  };
  '@opentelemetry/instrumentation-prisma'?: {
    enabled: boolean;
  };
  '@opentelemetry/instrumentation-redis'?: {
    enabled: boolean;
  };
  [key: string]: unknown;
}

// Span processor types
export interface SpanProcessorConfig {
  maxExportBatchSize?: number;
  maxQueueSize?: number;
  exportTimeoutMillis?: number;
  scheduledDelayMillis?: number;
}

// Node SDK configuration - avoid extending to prevent conflicts
export interface TracingNodeSDKConfig {
  resource?: Resource;
  spanProcessor?: unknown; // BatchSpanProcessor or SimpleSpanProcessor
  instrumentations?: unknown[];
  sampler?: Sampler;
  // Add other common NodeSDKConfiguration properties as needed
  serviceName?: string;
  serviceVersion?: string;
  traceExporter?: unknown;
  metricReader?: unknown;
  views?: unknown[];
  textMapPropagator?: unknown;
}

// Separate interface for SDK configuration without inheritance conflicts
export interface SDKConfigurationOptions extends Partial<NodeSDKConfiguration> {
  // This can safely extend NodeSDKConfiguration since it's for options only
}

// SDK instance type
export interface TracingSDK {
  start(): void;
  shutdown(): Promise<void>;
  addResource(resource: Resource): void;
}

// Utility types for tracing context
export interface TracingContext {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  baggage?: Record<string, string>;
}

export interface TracingMetadata {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  timestamp: string;
  samplingRatio?: number;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  enabled: boolean;
}

// Hook function types
// Hook function types
export type IgnoreIncomingRequestHook = (request: IncomingHttpRequest) => boolean;
export type RequestHook = (
  span: TracingSpan,
  request: IncomingHttpRequest | OutgoingHttpRequest,
) => void;
export type ResponseHook = (span: TracingSpan, response: HttpInstrumentationResponse) => void;
export type LayerIgnoreFunction = (name: string, type: ExpressLayerType) => boolean;

// Export commonly used OpenTelemetry types for convenience
export type {
  Attributes,
  AttributeValue,
  Context,
  Link,
  TraceState,
  SamplingDecision,
} from '@opentelemetry/api';
export type { SamplingResult } from '@opentelemetry/sdk-trace-base';

// Error handling in tracing context
export interface TracingError extends Error {
  name: string;
  message: string;
  stack?: string;
  span?: TracingSpan;
  traceId?: string;
  spanId?: string;
}
