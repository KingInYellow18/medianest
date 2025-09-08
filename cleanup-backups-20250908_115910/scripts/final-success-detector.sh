#!/bin/bash

# Final Success Detector - Ultimate build success validation

echo "🔍 FINAL SUCCESS DETECTOR ACTIVE - $(date)"
echo "=============================================="

SUCCESS_ACHIEVED=false
CHECK_COUNT=0

while [ "$SUCCESS_ACHIEVED" = false ]; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    echo "🔄 Check #$CHECK_COUNT - $(date)"
    
    # Run build and capture all output
    npm run build > /tmp/final_build_check.txt 2>&1
    BUILD_EXIT_CODE=$?
    
    # Count different error types
    ERROR_COUNT=$(grep -c "error TS" /tmp/final_build_check.txt || echo "0")
    WARNING_COUNT=$(grep -c "warning" /tmp/final_build_check.txt || echo "0")
    
    echo "   🏗️  Build Exit Code: $BUILD_EXIT_CODE"
    echo "   ❌ TypeScript Errors: $ERROR_COUNT"
    echo "   ⚠️  Warnings: $WARNING_COUNT"
    
    # Check for complete success
    if [ $BUILD_EXIT_CODE -eq 0 ] && [ $ERROR_COUNT -eq 0 ]; then
        echo ""
        echo "🎉 ================================="
        echo "🏆 BUILD SUCCESS DETECTED!"
        echo "🎯 GOAL ACHIEVED: Zero compilation errors!"
        echo "================================= 🎉"
        echo ""
        
        # Validate artifacts exist
        echo "🧪 Validating build artifacts..."
        BACKEND_JS_COUNT=$(find backend/dist -name "*.js" 2>/dev/null | wc -l)
        SHARED_JS_COUNT=$(find shared/dist -name "*.js" 2>/dev/null | wc -l)
        
        echo "   📂 Backend JS files: $BACKEND_JS_COUNT"
        echo "   📂 Shared JS files: $SHARED_JS_COUNT"
        
        # Check essential files
        if [ -f "backend/dist/server.js" ] && [ -f "shared/dist/index.js" ]; then
            echo "   ✅ Essential build files confirmed"
            
            # Test application startup
            echo "🚀 Testing application startup..."
            timeout 10s npm start > /tmp/final_startup_test.txt 2>&1 &
            STARTUP_PID=$!
            sleep 4
            
            if kill -0 $STARTUP_PID 2>/dev/null; then
                echo "   ✅ Application starts successfully!"
                kill $STARTUP_PID 2>/dev/null
                
                # Log final success
                echo "🏁 COMPLETE SUCCESS ACHIEVED - $(date)" > /tmp/final_success.flag
                echo ""
                echo "🎊 ================================="
                echo "🏆 ALL SUCCESS CRITERIA MET!"
                echo "✅ Build compiles without errors"
                echo "✅ All artifacts generated"  
                echo "✅ Application starts successfully"
                echo "================================= 🎊"
                
                SUCCESS_ACHIEVED=true
            else
                echo "   ❌ App failed to start"
                echo "   📋 Startup log:"
                tail -5 /tmp/final_startup_test.txt | sed 's/^/      /'
            fi
        else
            echo "   ❌ Missing essential build artifacts"
        fi
    else
        echo "   📊 Build not yet successful"
        
        if [ $ERROR_COUNT -gt 0 ]; then
            echo "   🔍 Sample errors:"
            grep "error TS" /tmp/final_build_check.txt | head -3 | sed 's/^/      /'
        fi
    fi
    
    echo "---"
    
    # Wait before next check
    if [ "$SUCCESS_ACHIEVED" = false ]; then
        sleep 15
    fi
done

echo "🎯 Final Success Detector completed successfully!"