#!/bin/bash

# Bulk Console.log Replacement Script
# This script systematically replaces console statements with structured logging

set -e

BACKEND_DIR="/home/kinginyellow/projects/medianest/backend"
cd "$BACKEND_DIR"

echo "🚀 Starting bulk console.log replacement..."

# Function to add logger import to a file if needed
add_logger_import() {
    local file="$1"
    
    # Check if file already has logger import
    if ! grep -q "import.*logger.*from\|require.*logger" "$file"; then
        # Check if file has console statements
        if grep -q "console\." "$file"; then
            echo "  📝 Adding logger import to: $(basename "$file")"
            
            # For TypeScript files with existing imports
            if [[ "$file" == *.ts ]] && grep -q "^import " "$file"; then
                # Find the last import line and add logger import after it
                sed -i '/^import /a\import { logger } from '"'"'../utils/logger'"'"';' "$file"
            else
                # Add at the beginning for other files
                sed -i '1i\const { logger } = require('"'"'../utils/logger'"'"');' "$file"
            fi
        fi
    fi
}

# Function to replace console statements in a file
replace_console_statements() {
    local file="$1"
    local changed=false
    
    # console.log patterns
    if sed -i "s/console\.log('\\([^']*\\)')/logger.info('\\1')/g" "$file" && grep -q "logger.info" "$file"; then
        changed=true
    fi
    
    if sed -i 's/console\.log(\`\([^\`]*\)\`)/logger.info(`\1`)/g' "$file"; then
        changed=true
    fi
    
    # console.error patterns  
    if sed -i "s/console\.error('\\([^']*\\)', \\(.*\\))/logger.error('\\1', { error: \\2 })/g" "$file"; then
        changed=true
    fi
    
    if sed -i "s/console\.error('\\([^']*\\)')/logger.error('\\1')/g" "$file"; then
        changed=true
    fi
    
    # console.warn patterns
    if sed -i "s/console\.warn('\\([^']*\\)', \\(.*\\))/logger.warn('\\1', { data: \\2 })/g" "$file"; then
        changed=true
    fi
    
    if sed -i "s/console\.warn('\\([^']*\\)')/logger.warn('\\1')/g" "$file"; then
        changed=true
    fi
    
    if $changed; then
        echo "  ✅ Updated: $(basename "$file")"
        return 0
    else
        return 1
    fi
}

# Process all TypeScript files in src with console statements
processed_count=0
total_count=0

for file in $(find src -name "*.ts" -exec grep -l "console\." {} \;); do
    total_count=$((total_count + 1))
    
    echo "📝 Processing: $file"
    
    # Add logger import first
    add_logger_import "$file"
    
    # Replace console statements
    if replace_console_statements "$file"; then
        processed_count=$((processed_count + 1))
    fi
done

echo ""
echo "📊 Bulk replacement complete:"
echo "   Files processed: $processed_count"  
echo "   Total files: $total_count"

# Verify remaining console statements
echo ""
echo "🔍 Checking remaining console statements..."
remaining=$(find src -name "*.ts" -exec grep -c "console\." {} \; 2>/dev/null | paste -sd+ | bc)
echo "   Remaining console statements: $remaining"

if [ "$remaining" -eq 0 ]; then
    echo "✅ All console statements successfully replaced!"
else
    echo "⚠️  Some console statements may need manual review:"
    find src -name "*.ts" -exec grep -Hn "console\." {} \; || true
fi

echo ""
echo "✨ Bulk replacement script completed!"