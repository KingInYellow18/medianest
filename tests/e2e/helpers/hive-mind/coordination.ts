import { test as base } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HiveMindContext {
  sessionId: string;
  agentType: string;
  memoryKeys: string[];
  testData: Record<string, any>;
}

export const test = base.extend<{
  hiveMind: HiveMindContext;
}>({
  hiveMind: async ({ page }, use, testInfo) => {
    const sessionId = `e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const agentType = testInfo.title.split(' ')[0].toLowerCase();
    const memoryKeys: string[] = [];
    const testData: Record<string, any> = {};

    const hiveMindContext: HiveMindContext = {
      sessionId,
      agentType,
      memoryKeys,
      testData,
    };

    // Initialize HIVE-MIND session
    await initializeHiveMind(hiveMindContext);

    // Use the context in the test
    await use(hiveMindContext);

    // Clean up session
    await cleanupHiveMind(hiveMindContext);
  },
});

export async function initializeHiveMind(context: HiveMindContext): Promise<void> {
  try {
    // Initialize session with HIVE-MIND hooks
    await execAsync(`npx claude-flow@alpha hooks session-restore --session-id "${context.sessionId}"`);
    
    // Store session metadata
    await storeInMemory(context, 'session/metadata', {
      sessionId: context.sessionId,
      agentType: context.agentType,
      startTime: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(`HIVE-MIND initialization warning:`, error);
  }
}

export async function storeInMemory(
  context: HiveMindContext,
  key: string,
  data: any,
): Promise<void> {
  try {
    const memoryKey = `${context.sessionId}/${key}`;
    context.memoryKeys.push(memoryKey);
    
    // Store in local test context
    context.testData[key] = data;
    
    // Store in HIVE-MIND memory
    await execAsync(`npx claude-flow@alpha hooks post-edit --memory-key "${memoryKey}" --data '${JSON.stringify(data)}'`);
  } catch (error) {
    console.warn(`Memory storage warning for key ${key}:`, error);
  }
}

export async function retrieveFromMemory(
  context: HiveMindContext,
  key: string,
): Promise<any> {
  try {
    // First try local context
    if (context.testData[key]) {
      return context.testData[key];
    }
    
    // Fall back to HIVE-MIND memory retrieval
    const memoryKey = `${context.sessionId}/${key}`;
    const result = await execAsync(`npx claude-flow@alpha hooks memory-get --key "${memoryKey}"`);
    
    if (result.stdout) {
      return JSON.parse(result.stdout);
    }
  } catch (error) {
    console.warn(`Memory retrieval warning for key ${key}:`, error);
  }
  
  return null;
}

export async function notifyHiveMind(
  context: HiveMindContext,
  message: string,
  data?: any,
): Promise<void> {
  try {
    const notification = {
      sessionId: context.sessionId,
      agentType: context.agentType,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    await execAsync(`npx claude-flow@alpha hooks notify --message "${message}"`);
    
    // Store notification in memory for other tests
    await storeInMemory(context, `notifications/${Date.now()}`, notification);
  } catch (error) {
    console.warn(`HIVE-MIND notification warning:`, error);
  }
}

export async function cleanupHiveMind(context: HiveMindContext): Promise<void> {
  try {
    // Store final session data
    await storeInMemory(context, 'session/completion', {
      sessionId: context.sessionId,
      endTime: new Date().toISOString(),
      memoryKeys: context.memoryKeys,
    });
    
    // End session
    await execAsync(`npx claude-flow@alpha hooks session-end --export-metrics true`);
  } catch (error) {
    console.warn(`HIVE-MIND cleanup warning:`, error);
  }
}

export const expect = base.expect;