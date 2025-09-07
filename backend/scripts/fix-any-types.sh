#!/bin/bash
# Script to systematically replace 'any' types with proper TypeScript types

set -e

echo "🔧 Starting TypeScript 'any' types batch fix..."

# Function to add import to file if not present
add_import_if_missing() {
    local file=$1
    local import_statement=$2
    
    if ! grep -q "$import_statement" "$file"; then
        # Find the last import line and add the new import after it
        local last_import_line=$(grep -n "^import\|^const.*require" "$file" | tail -1 | cut -d: -f1)
        if [ ! -z "$last_import_line" ]; then
            sed -i "${last_import_line}a\\$import_statement" "$file"
        else
            # If no imports, add at the top after any comments
            sed -i "1i\\$import_statement" "$file"
        fi
    fi
}

# Fix error handling patterns
echo "📝 Fixing error handling patterns..."
find src -name "*.ts" -type f | while read file; do
    if grep -q "} catch (error: any)" "$file" || grep -q "catch (error: any)" "$file"; then
        echo "  - Fixing error handling in $file"
        add_import_if_missing "$file" "import { CatchError } from '../types/common';"
        sed -i 's/} catch (error: any) {/} catch (error: CatchError) {/g' "$file"
        sed -i 's/catch (error: any) {/catch (error: CatchError) {/g' "$file"
        sed -i 's/    } catch (error: any) {/    } catch (error: CatchError) {/g' "$file"
        sed -i 's/      } catch (error: any) {/      } catch (error: CatchError) {/g' "$file"
        # Fix error.message usage
        sed -i 's/error: error\.message/error: error instanceof Error ? error.message : "Unknown error"/g' "$file"
    fi
done

# Fix common configuration patterns
echo "📝 Fixing configuration patterns..."
find src -name "*.ts" -type f | while read file; do
    if grep -q ": any" "$file"; then
        echo "  - Checking config patterns in $file"
        # Fix simple value types
        sed -i 's/value: any,/value: unknown,/g' "$file"
        sed -i 's/value: any;/value: unknown;/g' "$file"
        sed -i 's/config: any/config: UnknownRecord/g' "$file"
        sed -i 's/options: any/options: UnknownRecord/g' "$file"
        sed -i 's/params: any/params: UnknownRecord/g' "$file"
        sed -i 's/data: any/data: unknown/g' "$file"
        sed -i 's/result: any/result: unknown/g' "$file"
        sed -i 's/response: any/response: unknown/g' "$file"
        sed -i 's/context: any/context: UnknownRecord/g' "$file"
    fi
done

# Fix array patterns
echo "📝 Fixing array patterns..."
find src -name "*.ts" -type f | while read file; do
    if grep -q "any\[\]" "$file"; then
        echo "  - Fixing arrays in $file"
        sed -i 's/: any\[\]/: unknown[]/g' "$file"
        sed -i 's/Array<any>/Array<unknown>/g' "$file"
    fi
done

# Fix function signatures
echo "📝 Fixing function signatures..."
find src -name "*.ts" -type f | while read file; do
    if grep -q "(...args: any" "$file"; then
        echo "  - Fixing function signatures in $file"
        sed -i 's/(...args: any\[\])/(...args: unknown[])/g' "$file"
        sed -i 's/(...args: any)/(...args: unknown[])/g' "$file"
    fi
done

# Fix specific patterns for Redis mocks
if [ -f "src/config/test-redis.ts" ]; then
    echo "📝 Fixing Redis mock types..."
    add_import_if_missing "src/config/test-redis.ts" "import { UnknownRecord } from '../types/common';"
    sed -i 's/: any;/: unknown;/g' "src/config/test-redis.ts"
    sed -i 's/: any\[\]/: unknown[]/g' "src/config/test-redis.ts"
    sed -i 's/let hash: any/let hash: UnknownRecord/g' "src/config/test-redis.ts"
    sed -i 's/let list: any\[\]/let list: unknown[]/g' "src/config/test-redis.ts"
fi

# Fix specific patterns for Sentry
if [ -f "src/config/sentry.ts" ]; then
    echo "📝 Fixing Sentry types..."
    add_import_if_missing "src/config/sentry.ts" "import { UnknownRecord } from '../types/common';"
    sed -i 's/context?: any/context?: UnknownRecord/g' "src/config/sentry.ts"
    sed -i 's/level: any/level: string/g' "src/config/sentry.ts"
    sed -i 's/user: any/user: UnknownRecord/g' "src/config/sentry.ts"
    sed -i 's/value: any/value: unknown/g' "src/config/sentry.ts"
    sed -i 's/breadcrumb: any/breadcrumb: UnknownRecord/g' "src/config/sentry.ts"
    sed -i 's/event: any/event: UnknownRecord/g' "src/config/sentry.ts"
    sed -i 's/error: any/error: Error/g' "src/config/sentry.ts"
    sed -i 's/): any/): unknown/g' "src/config/sentry.ts"
fi

echo "✅ TypeScript 'any' types batch fix completed!"
echo "🔍 Remaining 'any' types:"
grep -r ": any" src --include="*.ts" | grep -v node_modules | grep -v ".d.ts" | wc -l