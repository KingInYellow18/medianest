# OpenAPI/Swagger Setup Guide for MediaNest

## Overview

MediaNest provides an OpenAPI 3.0 specification that documents all API endpoints, request/response schemas, and authentication requirements. This specification can be used to:

- Generate interactive API documentation
- Generate client SDKs in multiple languages
- Validate API requests and responses
- Mock API endpoints for testing

## OpenAPI Specification

The OpenAPI specification is located at: `docs/openapi.yaml`

## Viewing the Documentation

### Option 1: Swagger UI (Recommended)

1. **Install Swagger UI as a dependency:**

   ```bash
   cd backend
   npm install swagger-ui-express @types/swagger-ui-express --save
   ```

2. **Add Swagger UI route to Express:**

   ```typescript
   // backend/src/routes/index.ts
   import swaggerUi from 'swagger-ui-express';
   import yaml from 'js-yaml';
   import fs from 'fs';
   import path from 'path';

   // Load OpenAPI spec
   const openApiSpec = yaml.load(
     fs.readFileSync(path.join(__dirname, '../../../docs/openapi.yaml'), 'utf8')
   );

   // Serve Swagger UI at /api/docs
   router.use('/docs', swaggerUi.serve);
   router.get(
     '/docs',
     swaggerUi.setup(openApiSpec, {
       customCss: '.swagger-ui .topbar { display: none }',
       customSiteTitle: 'MediaNest API Documentation',
     })
   );
   ```

3. **Access the documentation:**
   - Development: http://localhost:4000/api/docs
   - Production: https://medianest.yourdomain.com/api/docs

### Option 2: ReDoc

1. **Install ReDoc:**

   ```bash
   npm install redoc-express
   ```

2. **Add ReDoc route:**

   ```typescript
   import redoc from 'redoc-express';

   router.get(
     '/redoc',
     redoc({
       title: 'MediaNest API Documentation',
       specUrl: '/api/openapi.json',
     })
   );
   ```

### Option 3: Standalone Tools

Use online tools to view the documentation:

- [Swagger Editor](https://editor.swagger.io/)
- [ReDoc Demo](https://redocly.github.io/redoc/)
- [Stoplight Studio](https://stoplight.io/studio/)

## Generating Client SDKs

### TypeScript/JavaScript Client

1. **Install OpenAPI Generator:**

   ```bash
   npm install @openapitools/openapi-generator-cli -g
   ```

2. **Generate TypeScript client:**

   ```bash
   openapi-generator-cli generate \
     -i docs/openapi.yaml \
     -g typescript-axios \
     -o frontend/src/lib/generated-api \
     --additional-properties=withSeparateModelsAndApi=true,supportsES6=true
   ```

3. **Use the generated client:**

   ```typescript
   import { MediaApi, Configuration } from '@/lib/generated-api';

   const config = new Configuration({
     basePath: 'http://localhost:4000/api/v1',
     credentials: 'include', // For cookie auth
   });

   const mediaApi = new MediaApi(config);

   // Search for media
   const results = await mediaApi.searchMedia({ q: 'Breaking Bad' });
   ```

### Python Client

```bash
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o clients/python \
  --additional-properties=packageName=medianest_client
```

### Other Languages

OpenAPI Generator supports 50+ languages including:

- Java
- Go
- Ruby
- PHP
- C#
- Swift
- Kotlin

## Validating API Responses

### Using express-openapi-validator

1. **Install the validator:**

   ```bash
   npm install express-openapi-validator
   ```

2. **Add validation middleware:**

   ```typescript
   import OpenApiValidator from 'express-openapi-validator';

   app.use(
     OpenApiValidator.middleware({
       apiSpec: './docs/openapi.yaml',
       validateRequests: true,
       validateResponses: true,
     })
   );
   ```

## Mocking API Endpoints

### Using Prism

1. **Install Prism:**

   ```bash
   npm install -g @stoplight/prism-cli
   ```

2. **Start mock server:**

   ```bash
   prism mock docs/openapi.yaml -p 4001
   ```

3. **Use mock endpoints:**
   ```bash
   curl http://localhost:4001/api/v1/media/search?q=test
   ```

## Keeping Documentation in Sync

### Best Practices

1. **Update spec when adding endpoints:**

   - Add path definition
   - Define request/response schemas
   - Include examples

2. **Version your API:**

   - Use `/api/v1`, `/api/v2` for breaking changes
   - Document deprecations

3. **Validate spec regularly:**

   ```bash
   npx @apidevtools/swagger-cli validate docs/openapi.yaml
   ```

4. **Generate documentation on CI:**

   ```yaml
   # .github/workflows/docs.yml
   - name: Validate OpenAPI spec
     run: npx @apidevtools/swagger-cli validate docs/openapi.yaml

   - name: Generate API docs
     run: npm run generate:api-docs
   ```

## Development Workflow

1. **Design-First Approach:**

   - Update OpenAPI spec first
   - Generate types/mocks
   - Implement endpoint
   - Validate against spec

2. **Code-First Approach:**
   - Implement endpoint
   - Update OpenAPI spec
   - Validate implementation
   - Generate client code

## Tools and Extensions

### VS Code Extensions

- [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi)
- [Swagger Viewer](https://marketplace.visualstudio.com/items?itemName=Arjun.swagger-viewer)

### CLI Tools

- `swagger-cli` - Validate and bundle specs
- `openapi-generator-cli` - Generate clients/servers
- `prism` - Mock server
- `portman` - Generate Postman collections

## Example Integration

Here's a complete example of integrating OpenAPI documentation into the backend:

```typescript
// backend/src/app.ts
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const app = express();

// Load OpenAPI spec
const openApiSpec = yaml.load(
  fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8')
) as any;

// Update server URL based on environment
if (process.env.NODE_ENV === 'production') {
  openApiSpec.servers = [
    {
      url: process.env.API_URL || 'https://medianest.yourdomain.com/api/v1',
      description: 'Production server',
    },
  ];
}

// Serve OpenAPI spec as JSON
app.get('/api/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Serve Swagger UI
app.use('/api/docs', swaggerUi.serve);
app.get(
  '/api/docs',
  swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MediaNest API Documentation',
    customfavIcon: '/favicon.ico',
  })
);

// Redirect root to docs
app.get('/api', (req, res) => {
  res.redirect('/api/docs');
});
```

## Next Steps

1. **Expand the specification** to include all endpoints
2. **Add more detailed schemas** for complex objects
3. **Include request/response examples**
4. **Set up automatic client generation** in CI/CD
5. **Add API versioning strategy**
6. **Implement request/response validation**
