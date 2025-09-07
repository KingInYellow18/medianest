#!/bin/bash

# Build Monitor Script - Tracks compilation progress and validates success

LOG_FILE="/tmp/medianest-build-monitor.log"
SUCCESS_FILE="/tmp/medianest-build-success.flag"

# Remove previous success flag
rm -f "$SUCCESS_FILE"

echo "🔍 BUILD MONITOR STARTED - $(date)" | tee -a "$LOG_FILE"
echo "===========================================" | tee -a "$LOG_FILE"

# Function to run build and analyze results
monitor_build() {
    echo "🚀 Running build attempt..." | tee -a "$LOG_FILE"
    
    # Run build and capture output
    npm run build > /tmp/build_output.txt 2>&1
    BUILD_EXIT_CODE=$?
    
    # Count errors
    ERROR_COUNT=$(grep -c "error TS" /tmp/build_output.txt || echo "0")
    WARNING_COUNT=$(grep -c "warning TS" /tmp/build_output.txt || echo "0")
    
    echo "📊 Build Results:" | tee -a "$LOG_FILE"
    echo "   Exit Code: $BUILD_EXIT_CODE" | tee -a "$LOG_FILE"
    echo "   TypeScript Errors: $ERROR_COUNT" | tee -a "$LOG_FILE"
    echo "   Warnings: $WARNING_COUNT" | tee -a "$LOG_FILE"
    
    # Check if build succeeded
    if [ $BUILD_EXIT_CODE -eq 0 ] && [ $ERROR_COUNT -eq 0 ]; then
        echo "✅ BUILD SUCCESS!" | tee -a "$LOG_FILE"
        echo "$(date)" > "$SUCCESS_FILE"
        return 0
    else
        echo "❌ Build failed with $ERROR_COUNT errors" | tee -a "$LOG_FILE"
        
        # Show top error categories
        echo "🔍 Top Error Categories:" | tee -a "$LOG_FILE"
        grep "error TS" /tmp/build_output.txt | cut -d: -f4 | sort | uniq -c | sort -nr | head -5 | tee -a "$LOG_FILE"
        
        return 1
    fi
}

# Function to validate successful build
validate_build_success() {
    echo "🧪 Validating build artifacts..." | tee -a "$LOG_FILE"
    
    # Check if dist directories exist and have content
    BACKEND_DIST_FILES=$(find backend/dist -name "*.js" 2>/dev/null | wc -l)
    SHARED_DIST_FILES=$(find shared/dist -name "*.js" 2>/dev/null | wc -l)
    
    echo "   Backend dist files: $BACKEND_DIST_FILES" | tee -a "$LOG_FILE"
    echo "   Shared dist files: $SHARED_DIST_FILES" | tee -a "$LOG_FILE"
    
    # Check if main server files exist
    if [ -f "backend/dist/server.js" ] && [ -f "shared/dist/index.js" ]; then
        echo "✅ Essential build artifacts present" | tee -a "$LOG_FILE"
        return 0
    else
        echo "❌ Missing essential build artifacts" | tee -a "$LOG_FILE"
        return 1
    fi
}

# Function to test application startup
test_app_startup() {
    echo "🚀 Testing application startup..." | tee -a "$LOG_FILE"
    
    # Try to start the application with timeout
    timeout 10s npm start > /tmp/startup_test.txt 2>&1 &
    STARTUP_PID=$!
    
    sleep 5
    
    # Check if process is still running
    if kill -0 $STARTUP_PID 2>/dev/null; then
        echo "✅ Application starts successfully" | tee -a "$LOG_FILE"
        kill $STARTUP_PID 2>/dev/null
        return 0
    else
        echo "❌ Application failed to start" | tee -a "$LOG_FILE"
        cat /tmp/startup_test.txt | tail -10 | tee -a "$LOG_FILE"
        return 1
    fi
}

# Main monitoring function
main() {
    while true; do
        echo "⏱️  $(date) - Checking build status..." | tee -a "$LOG_FILE"
        
        if monitor_build; then
            if validate_build_success; then
                if test_app_startup; then
                    echo "🎉 COMPLETE SUCCESS! Build compiles, artifacts exist, and app starts!" | tee -a "$LOG_FILE"
                    echo "🏁 Monitoring complete - all validation passed" | tee -a "$LOG_FILE"
                    exit 0
                else
                    echo "⚠️  Build compiles but app fails to start" | tee -a "$LOG_FILE"
                fi
            else
                echo "⚠️  Build compiles but missing artifacts" | tee -a "$LOG_FILE"
            fi
        fi
        
        echo "⏳ Waiting 30 seconds before next check..." | tee -a "$LOG_FILE"
        echo "==========================================" | tee -a "$LOG_FILE"
        sleep 30
    done
}

# Handle cleanup on exit
cleanup() {
    echo "🛑 Build monitoring stopped - $(date)" | tee -a "$LOG_FILE"
}

trap cleanup EXIT

# Start monitoring
main