#!/bin/bash

# Rapid Build Check - Tests every 10 seconds for immediate success detection

echo "🚀 RAPID BUILD CHECKER STARTED - $(date)"
echo "Checking every 10 seconds for build success..."

counter=1
while true; do
    echo "🔄 Check #$counter - $(date)"
    
    # Run quick build check
    npm run build > /tmp/rapid_build.txt 2>&1
    exit_code=$?
    error_count=$(grep -c "error TS" /tmp/rapid_build.txt || echo "0")
    
    if [ $exit_code -eq 0 ] && [ $error_count -eq 0 ]; then
        echo "🎉 BUILD SUCCESS DETECTED!"
        echo "✅ Exit Code: $exit_code"
        echo "✅ Errors: $error_count"
        
        # Validate artifacts
        if [ -f "backend/dist/server.js" ] && [ -f "shared/dist/index.js" ]; then
            echo "✅ Build artifacts confirmed"
            
            # Test startup
            echo "🧪 Testing application startup..."
            timeout 8s npm start > /tmp/startup_validation.txt 2>&1 &
            startup_pid=$!
            sleep 3
            
            if kill -0 $startup_pid 2>/dev/null; then
                echo "🎉 APPLICATION STARTS SUCCESSFULLY!"
                echo "🏆 ALL SUCCESS CRITERIA MET!"
                kill $startup_pid 2>/dev/null
                
                # Log final success
                echo "SUCCESS TIMESTAMP: $(date)" > /tmp/build_success_final.flag
                echo "Build compiles ✅"
                echo "Artifacts exist ✅"
                echo "App starts ✅"
                exit 0
            else
                echo "⚠️ Build succeeds but app fails to start"
                echo "Startup error log:"
                tail -5 /tmp/startup_validation.txt
            fi
        else
            echo "⚠️ Build succeeds but missing artifacts"
        fi
    else
        echo "❌ Exit: $exit_code, Errors: $error_count"
        if [ $error_count -gt 0 ]; then
            echo "🐛 Remaining errors:"
            grep "error TS" /tmp/rapid_build.txt | head -3
        fi
    fi
    
    echo "---"
    sleep 10
    counter=$((counter + 1))
done