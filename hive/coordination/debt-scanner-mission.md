# Technical Debt Scanner Agent Mission

## Agent Designation: DebtScanner
**Type**: analyst  
**Mission**: Comprehensive technical debt assessment using Serena integration

## Primary Objectives

### 1. Backend Test Failure Analysis (628 failing tests)
- Analyze current backend test failures using Serena memory integration
- Read Phase I success patterns from memory
- Identify specific failure patterns requiring DeviceSessionService template application
- Map failure categories and prioritize optimization targets

### 2. Technical Debt Pattern Recognition  
- Scan 127 problematic files identified in technical debt audit
- Categorize debt by severity (Critical P0, High P1, Medium P2, Low P3)
- Identify accumulated debt from rapid optimization phases
- Preserve Phase I achievements during analysis

### 3. Coordination with Hive-Mind
- Execute hooks: npx claude-flow@alpha hooks pre-task --description "Debt scanning analysis"
- Store findings in memory: npx claude-flow@alpha hooks post-edit --memory-key "hive/debt-scanner/analysis"
- Coordinate with other agents via memory sharing

## Success Criteria
- Complete analysis of 628 failing backend tests
- Strategic cleanup priorities established
- Zero regression on Phase I achievements
- Debt elimination roadmap created

## Agent Instructions
**Execute with Serena integration and memory coordination for maximum effectiveness**