/**
 * OpenTelemetry type definitions to replace 'any' types in tracing
 */
import type { Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import type { Resource } from '@opentelemetry/resources';
import type { Sampler, SamplingResult } from '@opentelemetry/sdk-trace-base';

// Core OpenTelemetry types
export interface TracingSpan extends Span {
  setAttributes(attributes: SpanAttributes): Span;
  setAttribute(key: string, value: AttributeValue): Span;
  setStatus(status: SpanStatus): Span;
  updateName(name: string): Span;
  end(endTime?: number): void;
}

export interface SpanAttributes {
  [key: string]: AttributeValue;
}

export type AttributeValue = string | number | boolean | Array<string | number | boolean>;

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
  startIncomingSpanHook?: (request: IncomingHttpRequest) => SpanAttributes;
  startOutgoingSpanHook?: (request: OutgoingHttpRequest) => SpanAttributes;
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

// Resource configuration types
export interface ResourceAttributes {
  [key: string]: AttributeValue;
  'service.name'?: string;
  'service.version'?: string;
  'service.instance.id'?: string;
  'deployment.environment'?: string;
}

export interface TracingResource extends Resource {
  attributes: ResourceAttributes;
  merge(other: Resource): Resource;
}

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

// Sampling types
export interface TracingSampler extends Sampler {
  shouldSample(
    context: unknown,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: SpanAttributes,
    links: unknown[]
  ): SamplingResult;
  toString(): string;
}

export interface CustomSamplingResult extends SamplingResult {
  decision: number; // SamplingDecision enum value
  attributes?: SpanAttributes;
  traceState?: unknown;
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

// Node SDK configuration
export interface TracingNodeSDKConfig extends Partial<NodeSDKConfiguration> {
  resource?: TracingResource;
  spanProcessor?: unknown; // BatchSpanProcessor or SimpleSpanProcessor
  instrumentations?: unknown[];
  sampler?: TracingSampler;
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
export type IgnoreIncomingRequestHook = (request: IncomingHttpRequest) => boolean;
export type RequestHook = (
  span: TracingSpan,
  request: IncomingHttpRequest | OutgoingHttpRequest
) => void;
export type ResponseHook = (span: TracingSpan, response: HttpInstrumentationResponse) => void;
export type LayerIgnoreFunction = (name: string, type: ExpressLayerType) => boolean;

// Error handling in tracing context
export interface TracingError extends Error {
  name: string;
  message: string;
  stack?: string;
  span?: TracingSpan;
  traceId?: string;
  spanId?: string;
}
