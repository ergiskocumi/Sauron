#!/bin/bash
# Test script per verificare che l'API si avvii correttamente

echo "🚀 Starting Sauron API server..."

# Attiva virtual environment
source .venv/bin/activate

# Avvia server in background
python -m uvicorn backend.api:app --host 127.0.0.1 --port 8000 > /dev/null 2>&1 &
SERVER_PID=$!

# Aspetta che il server sia pronto
echo "⏳ Waiting for server to start..."
sleep 3

# Test health check
echo "🔍 Testing health check endpoint..."
RESPONSE=$(curl -s http://127.0.0.1:8000/)

if [[ $RESPONSE == *"Sauron"* ]]; then
    echo "✅ Server is running correctly!"
    echo "📝 Response: $RESPONSE"
else
    echo "❌ Server test failed"
    echo "📝 Response: $RESPONSE"
fi

# Ferma il server
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null

echo ""
echo "✨ Test completed. To start the server manually:"
echo "   uvicorn backend.api:app --reload"
echo ""
echo "📚 Visit http://127.0.0.1:8000/docs for interactive API documentation"
