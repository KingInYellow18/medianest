#!/bin/bash

# Fix bad regex replacements that created invalid syntax
find backend/src -name "*.ts" -exec sed -i \
  -e 's/error\.message as any\?\./\(error\.message as any\)\?\./g' \
  -e 's/error\.stack as any\?\./\(error\.stack as any\)\?\./g' \
  -e 's/error\.code as any\?\./\(error\.code as any\)\?\./g' \
  -e 's/\.message as any\?\./\.message as any\)\?\./g' \
  -e 's/as Error\?\./as Error\)\?\./g' \
  -e 's/error as Error\?\./\(error as Error\)\?\./g' {} \;

echo "Fixed invalid syntax from regex replacements"