🏗️ MEDIANEST ARCHITECTURAL INTEGRITY REPORT
==========================================

📊 EXECUTIVE SUMMARY
-------------------
Total Modules Analyzed: 294
Circular Dependencies: 0 (0 high severity)
Layer Violations: 33 (3 critical)
Coupling Issues: 7 (4 critical, 3 concerning)

🎯 ARCHITECTURAL HEALTH SCORE: 0/100 (Grade: F)

🏛️ LAYER DISTRIBUTION
--------------------
unknown: 30 modules (10.2%)
infrastructure: 45 modules (15.3%)
presentation: 77 modules (26.2%)
data: 14 modules (4.8%)
business: 26 modules (8.8%)
shared: 102 modules (34.7%)

🚫 LAYER VIOLATIONS
------------------
1. MINOR: infrastructure layer should not depend on data layer
   backend/src/config/database.ts → backend/src/db/prisma.ts
2. MINOR: infrastructure layer should not depend on data layer
   backend/src/config/database.ts → backend/src/repositories/index.ts
3. MINOR: presentation layer should not depend on data layer
   backend/src/controllers/optimized-media.controller.ts → backend/src/repositories/optimized-media-request.repository.ts
4. MINOR: presentation layer should not depend on unknown layer
   backend/src/controllers/optimized-media.controller.ts → backend/src/lib/prisma.ts
5. MINOR: presentation layer should not depend on unknown layer
   backend/src/controllers/optimized-media.controller.ts → backend/src/auth/index.ts
6. MINOR: presentation layer should not depend on data layer
   backend/src/middleware/auth/device-session-manager.ts → backend/src/repositories/session-token.repository.ts
7. MINOR: presentation layer should not depend on data layer
   backend/src/middleware/auth/token-rotator.ts → backend/src/repositories/session-token.repository.ts
8. MINOR: presentation layer should not depend on data layer
   backend/src/middleware/auth/user-validator.ts → backend/src/repositories/user.repository.ts
9. MINOR: presentation layer should not depend on data layer
   backend/src/middleware/auth-cache.ts → backend/src/repositories/index.ts
10. MINOR: presentation layer should not depend on unknown layer
   backend/src/middleware/auth-validator.ts → backend/src/auth/index.ts
... and 23 more

🔗 COUPLING ISSUES
-----------------
1. CONCERNING: Excessive dependencies (high efferent coupling)
   Module: backend/src/routes/auth.ts
   Afferent: 0, Efferent: 19, Total: 19
2. CONCERNING: Excessive dependencies (high efferent coupling)
   Module: backend/src/routes/v1/index.ts
   Afferent: 2, Efferent: 17, Total: 19
3. CONCERNING: Excessive dependencies (high efferent coupling)
   Module: backend/src/server.ts
   Afferent: 0, Efferent: 17, Total: 17
4. CRITICAL: High coupling
   Module: backend/src/types/common.ts
   Afferent: 83, Efferent: 1, Total: 84
5. CRITICAL: God object (high afferent coupling)
   Module: backend/src/types/common.ts
   Afferent: 83, Efferent: 1, Total: 84
6. CRITICAL: High coupling
   Module: backend/src/utils/logger.ts
   Afferent: 92, Efferent: 0, Total: 92
7. CRITICAL: God object (high afferent coupling)
   Module: backend/src/utils/logger.ts
   Afferent: 92, Efferent: 0, Total: 92

💡 ARCHITECTURAL RECOMMENDATIONS
--------------------------------
• LAYER VIOLATIONS:
  - Move violating dependencies to appropriate layers
  - Implement proper dependency inversion
  - Use interfaces to decouple layers

• COUPLING ISSUES:
  - Apply Single Responsibility Principle
  - Extract smaller, focused modules
  - Use facade patterns for complex subsystems
  - Implement dependency injection

• GENERAL IMPROVEMENTS:
  - Implement architectural unit tests
  - Set up architectural fitness functions
  - Regular architectural reviews and refactoring
  - Document architectural decisions and constraints