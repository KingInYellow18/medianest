import { logger } from './logger';

/**
 * Transform object keys from camelCase to snake_case
 * @param obj - Object to transform
 * @returns Object with snake_case keys
 */
export function camelToSnakeCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }

  return result;
}

/**
 * Transform object keys from snake_case to camelCase
 * @param obj - Object to transform
 * @returns Object with camelCase keys
 */
export function snakeToCamelCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }

  return result;
}

/**
 * Deep transform object keys recursively
 * @param obj - Object to transform
 * @param transformer - Key transformation function
 * @returns Transformed object
 */
export function deepTransformKeys(obj: any, transformer: (key: string) => string): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => deepTransformKeys(item, transformer));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const transformedKey = transformer(key);
      result[transformedKey] = deepTransformKeys(value, transformer);
    }

    return result;
  }

  return obj;
}

/**
 * Remove null and undefined values from object
 * @param obj - Object to clean
 * @param removeEmptyStrings - Also remove empty strings
 * @returns Cleaned object
 */
export function removeNullUndefined<T extends Record<string, any>>(
  obj: T,
  removeEmptyStrings = false
): Partial<T> {
  if (!obj || typeof obj !== 'object') return obj;

  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (removeEmptyStrings && value === '') continue;

    result[key as keyof T] = value;
  }

  return result;
}

/**
 * Deep remove null and undefined values from nested objects
 * @param obj - Object to clean
 * @param removeEmptyStrings - Also remove empty strings
 * @returns Cleaned object
 */
export function deepRemoveNullUndefined(obj: any, removeEmptyStrings = false): any {
  if (obj === null || obj === undefined) return undefined;
  if (removeEmptyStrings && obj === '') return undefined;

  if (Array.isArray(obj)) {
    const cleaned = obj
      .map((item) => deepRemoveNullUndefined(item, removeEmptyStrings))
      .filter((item) => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = deepRemoveNullUndefined(value, removeEmptyStrings);
      if (cleanedValue !== undefined) {
        result[key] = cleanedValue;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  return obj;
}

/**
 * Pick specific fields from object
 * @param obj - Source object
 * @param fields - Fields to pick
 * @returns Object with only specified fields
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  fields: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }

  return result;
}

/**
 * Omit specific fields from object
 * @param obj - Source object
 * @param fields - Fields to omit
 * @returns Object without specified fields
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  fields: K[]
): Omit<T, K> {
  const result = { ...obj };

  for (const field of fields) {
    delete result[field];
  }

  return result as Omit<T, K>;
}

/**
 * Transform array to object using key selector
 * @param array - Array to transform
 * @param keySelector - Function to select key for each item
 * @returns Object with array items as values
 */
export function arrayToObject<T, K extends string | number | symbol>(
  array: T[],
  keySelector: (item: T, index: number) => K
): Record<K, T> {
  const result = {} as Record<K, T>;

  array.forEach((item, index) => {
    const key = keySelector(item, index);
    result[key] = item;
  });

  return result;
}

/**
 * Group array items by key
 * @param array - Array to group
 * @param keySelector - Function to select grouping key
 * @returns Object with grouped arrays
 */
export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keySelector: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;

  for (const item of array) {
    const key = keySelector(item);

    if (!result[key]) {
      result[key] = [];
    }

    result[key].push(item);
  }

  return result;
}

/**
 * Flatten nested object to single level with dot notation
 * @param obj - Object to flatten
 * @param prefix - Key prefix for recursion
 * @returns Flattened object
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten dot-notation object back to nested structure
 * @param obj - Flattened object to unflatten
 * @returns Nested object
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k && !(k in current)) {
        current[k] = {};
      }
      if (k) {
        current = current[k];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  return result;
}

/**
 * Deep merge multiple objects
 * @param target - Target object
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return deepMerge(target, ...sources);

  if (typeof target === 'object' && typeof source === 'object') {
    for (const key in source) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Convert string to different cases
 */
export const StringCase = {
  camelCase: (str: string): string => {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  },

  pascalCase: (str: string): string => {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '');
  },

  snakeCase: (str: string): string => {
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join('_');
  },

  kebabCase: (str: string): string => {
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join('-');
  },

  titleCase: (str: string): string => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  },
};

/**
 * Paginate array data
 * @param items - Array to paginate
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Paginated result
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number
): {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  return {
    items: items.slice(startIndex, endIndex),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Sort array by multiple criteria
 * @param array - Array to sort
 * @param criteria - Sort criteria
 * @returns Sorted array
 */
export function multiSort<T>(
  array: T[],
  criteria: Array<{
    key: keyof T;
    direction: 'asc' | 'desc';
    type?: 'string' | 'number' | 'date';
  }>
): T[] {
  return array.sort((a, b) => {
    for (const criterion of criteria) {
      const { key, direction, type = 'string' } = criterion;
      const aValue = a[key];
      const bValue = b[key];

      let comparison = 0;

      if (type === 'number') {
        comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
      } else if (type === 'date') {
        const aTime = new Date(aValue as any).getTime() || 0;
        const bTime = new Date(bValue as any).getTime() || 0;
        comparison = aTime - bTime;
      } else {
        comparison = String(aValue || '').localeCompare(String(bValue || ''));
      }

      if (comparison !== 0) {
        return direction === 'desc' ? -comparison : comparison;
      }
    }

    return 0;
  });
}

/**
 * Create transformation pipeline
 * @param transformers - Array of transformation functions
 * @returns Composed transformation function
 */
export function createTransformPipeline<T>(...transformers: Array<(data: T) => T>): (data: T) => T {
  return (data: T) => {
    return transformers.reduce((result, transformer) => {
      try {
        return transformer(result);
      } catch (error) {
        logger.error('Transform pipeline error', {
          transformer: transformer.name,
          error,
        });
        return result; // Return unchanged data on error
      }
    }, data);
  };
}

/**
 * Safe JSON parsing with fallback
 * @param str - JSON string to parse
 * @param fallback - Fallback value on parse error
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch (error) {
    logger.warn('JSON parse error, using fallback', { str, error });
    return fallback;
  }
}

/**
 * Safe JSON stringification
 * @param obj - Object to stringify
 * @param fallback - Fallback string on error
 * @returns JSON string or fallback
 */
export function safeJsonStringify(obj: any, fallback = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logger.warn('JSON stringify error, using fallback', { error });
    return fallback;
  }
}
