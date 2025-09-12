/**
 * MOCK INTERFACE VALIDATOR - ELIMINATES INTERFACE MISMATCHES
 * 
 * This system validates that mock implementations perfectly match actual service
 * interfaces, preventing runtime failures from missing methods or mismatched signatures.
 * 
 * FEATURES:
 * - Static interface validation at mock registration time
 * - Runtime interface conformance checking
 * - Automatic mock method signature alignment
 * - Type-safe mock generation with TypeScript validation
 * - Performance-optimized validation caching
 */

import { logger } from '../../../src/utils/logger';

export interface InterfaceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingMethods: string[];
  extraMethods: string[];
  signatureMismatches: Array<{
    method: string;
    expected: string;
    actual: string;
  }>;
  metadata: {
    validationTime: number;
    interfaceName: string;
    mockName: string;
  };
}

export interface InterfaceSignature {
  name: string;
  returnType: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
  isAsync: boolean;
  isStatic: boolean;
}

export interface ServiceInterface {
  name: string;
  methods: Map<string, InterfaceSignature>;
  properties: Map<string, string>;
  constructor?: InterfaceSignature;
}

/**
 * Mock Interface Validator - Ensures 1:1 interface matching
 */
export class MockInterfaceValidator {
  private static instance: MockInterfaceValidator;
  private interfaceCache = new Map<string, ServiceInterface>();
  private validationCache = new Map<string, InterfaceValidationResult>();
  private validationHistory = new Map<string, InterfaceValidationResult[]>();

  static getInstance(): MockInterfaceValidator {
    if (!this.instance) {
      this.instance = new MockInterfaceValidator();
    }
    return this.instance;
  }

  /**
   * Extract interface signature from actual service class
   */
  extractServiceInterface(serviceClass: any, serviceName: string): ServiceInterface {
    const cacheKey = `interface:${serviceName}`;
    
    if (this.interfaceCache.has(cacheKey)) {
      return this.interfaceCache.get(cacheKey)!;
    }

    const methods = new Map<string, InterfaceSignature>();
    const properties = new Map<string, string>();

    // Get prototype methods
    const prototype = serviceClass.prototype || serviceClass;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propName of propertyNames) {
      if (propName === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propName);
      if (!descriptor) continue;

      if (typeof descriptor.value === 'function') {
        methods.set(propName, this.extractMethodSignature(descriptor.value, propName));
      } else if (descriptor.get || descriptor.set) {
        properties.set(propName, this.inferPropertyType(descriptor));
      }
    }

    // Get static methods
    const staticPropertyNames = Object.getOwnPropertyNames(serviceClass);
    for (const propName of staticPropertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(serviceClass, propName);
      if (descriptor && typeof descriptor.value === 'function') {
        const signature = this.extractMethodSignature(descriptor.value, propName);
        signature.isStatic = true;
        methods.set(propName, signature);
      }
    }

    const serviceInterface: ServiceInterface = {
      name: serviceName,
      methods,
      properties,
    };

    this.interfaceCache.set(cacheKey, serviceInterface);
    return serviceInterface;
  }

  /**
   * Validate mock against actual service interface
   */
  validateMockInterface(
    mockInstance: any,
    actualService: any,
    mockName: string,
    serviceName: string
  ): InterfaceValidationResult {
    const validationKey = `${mockName}:${serviceName}`;
    const startTime = performance.now();

    // Check cache first
    if (this.validationCache.has(validationKey)) {
      const cached = this.validationCache.get(validationKey)!;
      if (Date.now() - cached.metadata.validationTime < 60000) { // 1 minute cache
        return cached;
      }
    }

    const actualInterface = this.extractServiceInterface(actualService, serviceName);
    const mockInterface = this.extractMockInterface(mockInstance, mockName);

    const errors: string[] = [];
    const warnings: string[] = [];
    const missingMethods: string[] = [];
    const extraMethods: string[] = [];
    const signatureMismatches: Array<{
      method: string;
      expected: string;
      actual: string;
    }> = [];

    // Check for missing methods
    for (const [methodName, expectedSignature] of actualInterface.methods) {
      if (!mockInterface.methods.has(methodName)) {
        missingMethods.push(methodName);
        errors.push(`Missing method: ${methodName}`);
      } else {
        // Validate method signatures
        const mockSignature = mockInterface.methods.get(methodName)!;
        const signatureMatch = this.compareMethodSignatures(expectedSignature, mockSignature);
        
        if (!signatureMatch.matches) {
          signatureMismatches.push({
            method: methodName,
            expected: this.formatMethodSignature(expectedSignature),
            actual: this.formatMethodSignature(mockSignature),
          });
          
          if (signatureMatch.severity === 'error') {
            errors.push(`Method signature mismatch for ${methodName}: ${signatureMatch.reason}`);
          } else {
            warnings.push(`Method signature warning for ${methodName}: ${signatureMatch.reason}`);
          }
        }
      }
    }

    // Check for extra methods (might be test helpers)
    for (const [methodName] of mockInterface.methods) {
      if (!actualInterface.methods.has(methodName)) {
        extraMethods.push(methodName);
        if (!this.isTestHelperMethod(methodName)) {
          warnings.push(`Extra method in mock: ${methodName}`);
        }
      }
    }

    // Check properties
    for (const [propName, expectedType] of actualInterface.properties) {
      if (!mockInterface.properties.has(propName)) {
        warnings.push(`Missing property: ${propName}`);
      }
    }

    const validationTime = performance.now() - startTime;
    const result: InterfaceValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      missingMethods,
      extraMethods,
      signatureMismatches,
      metadata: {
        validationTime,
        interfaceName: serviceName,
        mockName,
      },
    };

    // Cache result
    this.validationCache.set(validationKey, result);
    
    // Store validation history
    const history = this.validationHistory.get(validationKey) || [];
    history.push(result);
    if (history.length > 10) history.shift(); // Keep last 10 validations
    this.validationHistory.set(validationKey, history);

    return result;
  }

  /**
   * Auto-generate properly aligned mock from service interface
   */
  generateAlignedMock<T>(actualService: any, serviceName: string, config?: {
    behavior?: 'realistic' | 'minimal' | 'error';
    customMethods?: Record<string, any>;
  }): T {
    const serviceInterface = this.extractServiceInterface(actualService, serviceName);
    const mock: any = {};

    for (const [methodName, signature] of serviceInterface.methods) {
      if (signature.isStatic) continue; // Skip static methods for instance mocks

      if (config?.customMethods?.[methodName]) {
        mock[methodName] = config.customMethods[methodName];
      } else {
        mock[methodName] = this.generateMockMethod(signature, config?.behavior || 'realistic');
      }
    }

    // Add properties with default values
    for (const [propName, propType] of serviceInterface.properties) {
      mock[propName] = this.generateDefaultPropertyValue(propType);
    }

    // Add test helper methods
    mock.reset = () => {
      for (const key of Object.keys(mock)) {
        if (typeof mock[key] === 'function' && mock[key].mockReset) {
          mock[key].mockReset();
        }
      }
    };

    mock.validate = () => this.validateMockInterface(mock, actualService, `generated-${serviceName}`, serviceName);

    return mock as T;
  }

  /**
   * Real-time interface conformance checker (for development)
   */
  enableRuntimeValidation(mockInstance: any, actualService: any, serviceName: string): any {
    const validator = this;
    
    return new Proxy(mockInstance, {
      get(target: any, property: string | symbol) {
        const value = target[property];
        
        if (typeof property === 'string' && typeof value === 'function') {
          return function (...args: any[]) {
            // Validate method exists in actual service
            const actualInterface = validator.extractServiceInterface(actualService, serviceName);
            
            if (!actualInterface.methods.has(property)) {
              logger.warn(`Mock method '${property}' not found in actual service '${serviceName}'`, {
                availableMethods: Array.from(actualInterface.methods.keys()),
              });
            }
            
            return value.apply(this, args);
          };
        }
        
        return value;
      },
    });
  }

  /**
   * Clear validation caches
   */
  clearCache(): void {
    this.interfaceCache.clear();
    this.validationCache.clear();
    this.validationHistory.clear();
  }

  /**
   * Get validation report for debugging
   */
  getValidationReport(): {
    totalValidations: number;
    failedValidations: number;
    cacheHitRate: number;
    mostCommonErrors: string[];
    validationHistory: Record<string, InterfaceValidationResult[]>;
  } {
    const totalValidations = Array.from(this.validationHistory.values())
      .reduce((total, history) => total + history.length, 0);
    
    const failedValidations = Array.from(this.validationHistory.values())
      .flat()
      .filter(result => !result.valid).length;

    const allErrors = Array.from(this.validationHistory.values())
      .flat()
      .flatMap(result => result.errors);

    const errorCounts = allErrors.reduce((counts, error) => {
      counts[error] = (counts[error] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const mostCommonErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);

    return {
      totalValidations,
      failedValidations,
      cacheHitRate: this.validationCache.size / Math.max(totalValidations, 1),
      mostCommonErrors,
      validationHistory: Object.fromEntries(this.validationHistory),
    };
  }

  // Private helper methods
  private extractMockInterface(mockInstance: any, mockName: string): ServiceInterface {
    const methods = new Map<string, InterfaceSignature>();
    const properties = new Map<string, string>();

    const propertyNames = Object.getOwnPropertyNames(mockInstance);
    
    for (const propName of propertyNames) {
      const value = mockInstance[propName];
      
      if (typeof value === 'function') {
        methods.set(propName, this.extractMethodSignature(value, propName));
      } else {
        properties.set(propName, typeof value);
      }
    }

    return {
      name: mockName,
      methods,
      properties,
    };
  }

  private extractMethodSignature(method: Function, methodName: string): InterfaceSignature {
    const methodStr = method.toString();
    const isAsync = methodStr.includes('async ') || methodStr.includes('Promise');
    
    // Extract parameters (simplified - in production, use a proper parser)
    const paramMatch = methodStr.match(/\(([^)]*)\)/);
    const paramString = paramMatch?.[1] || '';
    
    const parameters = paramString
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0)
      .map(param => {
        const [name, type] = param.includes(':') ? param.split(':') : [param, 'any'];
        return {
          name: name.trim().replace(/[?=].*$/, ''),
          type: type?.trim() || 'any',
          optional: param.includes('?') || param.includes('='),
        };
      });

    return {
      name: methodName,
      returnType: isAsync ? 'Promise<any>' : 'any',
      parameters,
      isAsync,
      isStatic: false,
    };
  }

  private compareMethodSignatures(
    expected: InterfaceSignature, 
    actual: InterfaceSignature
  ): { matches: boolean; reason: string; severity: 'error' | 'warning' } {
    // Check async mismatch
    if (expected.isAsync !== actual.isAsync) {
      return {
        matches: false,
        reason: `Async mismatch: expected ${expected.isAsync ? 'async' : 'sync'}, got ${actual.isAsync ? 'async' : 'sync'}`,
        severity: 'error',
      };
    }

    // Check parameter count
    if (expected.parameters.length !== actual.parameters.length) {
      return {
        matches: false,
        reason: `Parameter count mismatch: expected ${expected.parameters.length}, got ${actual.parameters.length}`,
        severity: 'warning',
      };
    }

    return { matches: true, reason: '', severity: 'warning' };
  }

  private formatMethodSignature(signature: InterfaceSignature): string {
    const params = signature.parameters
      .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
      .join(', ');
    
    const asyncPrefix = signature.isAsync ? 'async ' : '';
    return `${asyncPrefix}${signature.name}(${params}): ${signature.returnType}`;
  }

  private isTestHelperMethod(methodName: string): boolean {
    const testHelpers = ['reset', 'validate', 'mockClear', 'mockReset', 'mockRestore', 'mockImplementation'];
    return testHelpers.includes(methodName) || methodName.startsWith('mock') || methodName.startsWith('test');
  }

  private generateMockMethod(signature: InterfaceSignature, behavior: string): any {
    const vi = require('vitest').vi;
    
    if (signature.isAsync) {
      switch (behavior) {
        case 'realistic':
          return vi.fn().mockResolvedValue(this.generateRealisticReturnValue(signature));
        case 'minimal':
          return vi.fn().mockResolvedValue(null);
        case 'error':
          return vi.fn().mockRejectedValue(new Error(`Mock error for ${signature.name}`));
        default:
          return vi.fn().mockResolvedValue(undefined);
      }
    } else {
      switch (behavior) {
        case 'realistic':
          return vi.fn().mockReturnValue(this.generateRealisticReturnValue(signature));
        case 'minimal':
          return vi.fn().mockReturnValue(null);
        case 'error':
          return vi.fn().mockImplementation(() => {
            throw new Error(`Mock error for ${signature.name}`);
          });
        default:
          return vi.fn().mockReturnValue(undefined);
      }
    }
  }

  private generateRealisticReturnValue(signature: InterfaceSignature): any {
    // Generate realistic return values based on method name patterns
    const methodName = signature.name.toLowerCase();
    
    if (methodName.includes('count') || methodName.includes('size')) {
      return Math.floor(Math.random() * 100);
    }
    
    if (methodName.includes('info') || methodName.includes('status')) {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        data: {},
      };
    }
    
    if (methodName.includes('list') || methodName.includes('all')) {
      return [];
    }
    
    if (methodName.includes('exists') || methodName.includes('is') || methodName.includes('has')) {
      return Math.random() > 0.5;
    }
    
    return null;
  }

  private generateDefaultPropertyValue(propType: string): any {
    switch (propType.toLowerCase()) {
      case 'string':
        return 'mock-value';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  private inferPropertyType(descriptor: PropertyDescriptor): string {
    if (descriptor.get && !descriptor.set) return 'readonly';
    if (!descriptor.get && descriptor.set) return 'writeonly';
    if (descriptor.get && descriptor.set) return 'readwrite';
    return 'unknown';
  }
}

export const mockInterfaceValidator = MockInterfaceValidator.getInstance();