/**
 * HIVE-MIND Coordinator for MediaNest API Mocking Framework
 * Provides intelligent state sharing and coordination between test agents
 */

export interface HiveMindConfig {
  nodeId: string
  enablePersistence: boolean
  coordinationType: 'centralized' | 'distributed' | 'mesh'
  syncInterval?: number
  maxStateSize?: number
  compressionEnabled?: boolean
}

export interface StateEntry {
  key: string
  value: any
  timestamp: number
  ttl?: number
  version: number
  source: string
}

export interface CoordinationEvent {
  type: 'state-change' | 'node-join' | 'node-leave' | 'sync-request' | 'conflict-resolution'
  source: string
  target?: string
  data: any
  timestamp: number
}

export interface NodeInfo {
  id: string
  type: string
  capabilities: string[]
  status: 'active' | 'inactive' | 'syncing'
  lastSeen: number
  metadata?: Record<string, any>
}

export class HiveMindCoordinator {
  private config: HiveMindConfig
  private state: Map<string, StateEntry> = new Map()
  private nodes: Map<string, NodeInfo> = new Map()
  private eventListeners: Map<string, Function[]> = new Map()
  private syncTimer: NodeJS.Timeout | null = null
  private isInitialized = false

  constructor(config: HiveMindConfig) {
    this.config = {
      syncInterval: 5000,
      maxStateSize: 1000,
      compressionEnabled: true,
      ...config
    }
  }

  /**
   * Initialize HIVE-MIND coordination
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('HIVE-MIND already initialized')
      return
    }

    console.log(`🧠 Initializing HIVE-MIND coordinator: ${this.config.nodeId}`)
    
    // Load persisted state if enabled
    if (this.config.enablePersistence) {
      await this.loadPersistedState()
    }

    // Register this node
    await this.registerNode({
      id: this.config.nodeId,
      type: 'coordinator',
      capabilities: ['state-management', 'event-coordination', 'conflict-resolution'],
      status: 'active',
      lastSeen: Date.now()
    })

    // Start sync timer if in distributed mode
    if (this.config.coordinationType !== 'centralized' && this.config.syncInterval) {
      this.syncTimer = setInterval(() => {
        this.performPeriodicSync()
      }, this.config.syncInterval)
    }

    this.isInitialized = true
    console.log('✅ HIVE-MIND coordinator initialized')
  }

  /**
   * Store state with versioning and conflict resolution
   */
  async storeState(key: string, value: any, ttl?: number): Promise<void> {
    const existing = this.state.get(key)
    const version = existing ? existing.version + 1 : 1
    
    const entry: StateEntry = {
      key,
      value: this.config.compressionEnabled ? this.compressValue(value) : value,
      timestamp: Date.now(),
      ttl,
      version,
      source: this.config.nodeId
    }

    this.state.set(key, entry)

    // Emit state change event
    await this.emitEvent({
      type: 'state-change',
      source: this.config.nodeId,
      data: { key, value, version },
      timestamp: Date.now()
    })

    // Persist if enabled
    if (this.config.enablePersistence) {
      await this.persistState(key, entry)
    }

    // Clean up expired entries
    this.cleanExpiredEntries()
  }

  /**
   * Retrieve state with intelligent caching
   */
  async getState(key: string): Promise<any> {
    const entry = this.state.get(key)
    
    if (!entry) {
      // Try to sync from other nodes if in distributed mode
      if (this.config.coordinationType !== 'centralized') {
        await this.requestStateSync(key)
        return this.state.get(key)?.value
      }
      return undefined
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.state.delete(key)
      return undefined
    }

    return this.config.compressionEnabled ? 
      this.decompressValue(entry.value) : entry.value
  }

  /**
   * Update existing state with merge strategy
   */
  async updateState(key: string, updates: any): Promise<void> {
    const existing = await this.getState(key)
    
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      // Merge objects
      const merged = { ...existing, ...updates }
      await this.storeState(key, merged)
    } else {
      // Replace primitive values
      await this.storeState(key, updates)
    }
  }

  /**
   * Clear specific state
   */
  async clearState(key: string): Promise<void> {
    this.state.delete(key)
    
    await this.emitEvent({
      type: 'state-change',
      source: this.config.nodeId,
      data: { key, value: null, deleted: true },
      timestamp: Date.now()
    })

    if (this.config.enablePersistence) {
      await this.removePersistentState(key)
    }
  }

  /**
   * Clear all state
   */
  async clearAllState(): Promise<void> {
    const keys = Array.from(this.state.keys())
    this.state.clear()

    for (const key of keys) {
      await this.emitEvent({
        type: 'state-change',
        source: this.config.nodeId,
        data: { key, value: null, deleted: true },
        timestamp: Date.now()
      })
    }

    if (this.config.enablePersistence) {
      await this.clearPersistedState()
    }
  }

  /**
   * Register a node in the HIVE-MIND network
   */
  async registerNode(nodeInfo: Omit<NodeInfo, 'lastSeen'>): Promise<void> {
    const node: NodeInfo = {
      ...nodeInfo,
      lastSeen: Date.now()
    }

    this.nodes.set(node.id, node)

    await this.emitEvent({
      type: 'node-join',
      source: this.config.nodeId,
      data: node,
      timestamp: Date.now()
    })

    console.log(`🤝 Node registered: ${node.id} (${node.type})`)
  }

  /**
   * Get information about all nodes
   */
  getNodes(): NodeInfo[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get nodes by capability
   */
  getNodesByCapability(capability: string): NodeInfo[] {
    return Array.from(this.nodes.values())
      .filter(node => node.capabilities.includes(capability))
  }

  /**
   * Emit coordination event
   */
  private async emitEvent(event: CoordinationEvent): Promise<void> {
    const listeners = this.eventListeners.get(event.type) || []
    
    for (const listener of listeners) {
      try {
        await listener(event)
      } catch (error) {
        console.error(`Event listener error for ${event.type}:`, error)
      }
    }

    // Broadcast to other nodes if in distributed mode
    if (this.config.coordinationType !== 'centralized') {
      await this.broadcastEvent(event)
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, listener: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType)!.push(listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, listener: Function): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * Perform conflict resolution between competing state updates
   */
  private async resolveStateConflict(key: string, localEntry: StateEntry, remoteEntry: StateEntry): Promise<StateEntry> {
    // Version-based resolution (higher version wins)
    if (remoteEntry.version > localEntry.version) {
      return remoteEntry
    } else if (localEntry.version > remoteEntry.version) {
      return localEntry
    }

    // Timestamp-based resolution (last writer wins)
    if (remoteEntry.timestamp > localEntry.timestamp) {
      return remoteEntry
    }

    // If still tied, use node ID for deterministic resolution
    return localEntry.source < remoteEntry.source ? localEntry : remoteEntry
  }

  /**
   * Perform periodic sync with other nodes
   */
  private async performPeriodicSync(): Promise<void> {
    const activeNodes = Array.from(this.nodes.values())
      .filter(node => node.status === 'active' && node.id !== this.config.nodeId)

    for (const node of activeNodes) {
      await this.syncWithNode(node.id)
    }

    // Clean up inactive nodes
    const now = Date.now()
    const inactiveThreshold = (this.config.syncInterval || 5000) * 3

    for (const [nodeId, node] of this.nodes.entries()) {
      if (now - node.lastSeen > inactiveThreshold) {
        this.nodes.delete(nodeId)
        await this.emitEvent({
          type: 'node-leave',
          source: this.config.nodeId,
          data: { nodeId },
          timestamp: now
        })
      }
    }
  }

  /**
   * Sync state with specific node
   */
  private async syncWithNode(nodeId: string): Promise<void> {
    // In a real implementation, this would use network communication
    // For testing purposes, we simulate sync behavior
    
    console.log(`🔄 Syncing with node: ${nodeId}`)
    
    // Update node last seen timestamp
    const node = this.nodes.get(nodeId)
    if (node) {
      node.lastSeen = Date.now()
      node.status = 'active'
    }
  }

  /**
   * Request state sync for specific key
   */
  private async requestStateSync(key: string): Promise<void> {
    await this.emitEvent({
      type: 'sync-request',
      source: this.config.nodeId,
      data: { key },
      timestamp: Date.now()
    })
  }

  /**
   * Broadcast event to other nodes
   */
  private async broadcastEvent(event: CoordinationEvent): Promise<void> {
    // In a real implementation, this would use network communication
    // For testing purposes, we simulate broadcast behavior
    console.log(`📡 Broadcasting event: ${event.type} from ${event.source}`)
  }

  /**
   * Clean up expired state entries
   */
  private cleanExpiredEntries(): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [key, entry] of this.state.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        toDelete.push(key)
      }
    }

    toDelete.forEach(key => this.state.delete(key))

    // Enforce max state size
    if (this.config.maxStateSize && this.state.size > this.config.maxStateSize) {
      const entries = Array.from(this.state.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.config.maxStateSize)
      toRemove.forEach(([key]) => this.state.delete(key))
    }
  }

  /**
   * Compress value for storage
   */
  private compressValue(value: any): string {
    // Simple JSON compression (in real implementation, use proper compression)
    return JSON.stringify(value)
  }

  /**
   * Decompress stored value
   */
  private decompressValue(compressed: string): any {
    try {
      return JSON.parse(compressed)
    } catch {
      return compressed
    }
  }

  /**
   * Load persisted state from storage
   */
  private async loadPersistedState(): Promise<void> {
    // In a real implementation, this would load from persistent storage
    console.log('📂 Loading persisted state...')
  }

  /**
   * Persist state entry to storage
   */
  private async persistState(key: string, entry: StateEntry): Promise<void> {
    // In a real implementation, this would save to persistent storage
    console.log(`💾 Persisting state: ${key}`)
  }

  /**
   * Remove state from persistent storage
   */
  private async removePersistentState(key: string): Promise<void> {
    // In a real implementation, this would remove from persistent storage
    console.log(`🗑️  Removing persisted state: ${key}`)
  }

  /**
   * Clear all persisted state
   */
  private async clearPersistedState(): Promise<void> {
    // In a real implementation, this would clear persistent storage
    console.log('🧹 Clearing all persisted state')
  }

  /**
   * Get current status of the coordinator
   */
  getStatus(): {
    nodeId: string
    isInitialized: boolean
    stateEntries: number
    connectedNodes: number
    coordinationType: string
    lastSync?: number
  } {
    return {
      nodeId: this.config.nodeId,
      isInitialized: this.isInitialized,
      stateEntries: this.state.size,
      connectedNodes: this.nodes.size,
      coordinationType: this.config.coordinationType,
      lastSync: this.syncTimer ? Date.now() : undefined
    }
  }

  /**
   * Get state statistics
   */
  getStateStats(): {
    totalEntries: number
    memoryUsage: number
    oldestEntry?: number
    newestEntry?: number
    entriesBySource: Record<string, number>
  } {
    const entries = Array.from(this.state.values())
    const entriesBySource = entries.reduce((acc, entry) => {
      acc[entry.source] = (acc[entry.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b)

    return {
      totalEntries: this.state.size,
      memoryUsage: JSON.stringify(Array.from(this.state.entries())).length,
      oldestEntry: timestamps[0],
      newestEntry: timestamps[timestamps.length - 1],
      entriesBySource
    }
  }

  /**
   * Cleanup and shutdown coordinator
   */
  async cleanup(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    await this.emitEvent({
      type: 'node-leave',
      source: this.config.nodeId,
      data: { nodeId: this.config.nodeId },
      timestamp: Date.now()
    })

    this.state.clear()
    this.nodes.clear()
    this.eventListeners.clear()
    this.isInitialized = false

    console.log('🛑 HIVE-MIND coordinator shutdown')
  }

  /**
   * Export state for debugging or migration
   */
  exportState(): Record<string, any> {
    const exported: Record<string, any> = {}
    
    for (const [key, entry] of this.state.entries()) {
      exported[key] = {
        value: this.config.compressionEnabled ? this.decompressValue(entry.value) : entry.value,
        timestamp: entry.timestamp,
        version: entry.version,
        source: entry.source
      }
    }

    return exported
  }

  /**
   * Import state from external source
   */
  async importState(stateData: Record<string, any>): Promise<void> {
    for (const [key, data] of Object.entries(stateData)) {
      await this.storeState(key, data.value)
    }

    console.log(`📥 Imported ${Object.keys(stateData).length} state entries`)
  }
}

export default HiveMindCoordinator