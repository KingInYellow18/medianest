#!/bin/bash

# Fix common TypeScript errors
find backend/src -name "*.ts" -exec sed -i \
  -e 's/error\.response\?\.status/error.response?.status!/g' \
  -e 's/error\.code/error.code as any/g' \
  -e 's/error\.message/error.message as any/g' \
  -e 's/error\.stack/error.stack as any/g' \
  -e 's/error\.response\.data/error.response?.data as any/g' \
  -e 's/catch (error)/catch (error: any)/g' \
  -e 's/\.catch((error)/\.catch((error: any)/g' \
  -e 's/error instanceof Error/error as Error/g' \
  -e 's/unknown\[\]/any[]/g' \
  -e 's/: unknown/: any/g' {} \;

echo "Fixed common error patterns"