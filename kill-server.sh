#!/bin/bash

# Kill Server Script
# This script will stop all running instances of the Portal Backend server

echo "🛑 Stopping Portal Backend server..."

# Kill ts-node-dev processes
echo "Killing ts-node-dev processes..."
pkill -f "ts-node-dev.*src/app.ts"

# Kill any remaining Node.js processes running the app
echo "Killing remaining Node.js processes..."
pkill -f "node.*app.ts"

# Kill any npm run dev processes
echo "Killing npm processes..."
pkill -f "npm run dev"

# Kill any processes on port 3000
echo "Checking port 3000..."
PORT_PID=$(lsof -ti:3000)
if [ ! -z "$PORT_PID" ]; then
    echo "Killing process on port 3000 (PID: $PORT_PID)..."
    kill -9 $PORT_PID
fi

# Wait a moment and check if anything is still running
sleep 2

# Check if any processes are still running
REMAINING=$(ps aux | grep -E "npm run dev|ts-node-dev.*src/app.ts|node.*app.ts" | grep -v grep | wc -l)

if [ $REMAINING -eq 0 ]; then
    echo "✅ All server processes stopped successfully!"
else
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "npm run dev|ts-node-dev.*src/app.ts|node.*app.ts" | grep -v grep
    echo ""
    echo "You may need to manually kill them with: kill -9 <PID>"
fi

echo "🔍 Port 3000 status:"
PORT_CHECK=$(lsof -ti:3000)
if [ -z "$PORT_CHECK" ]; then
    echo "✅ Port 3000 is free"
else
    echo "⚠️  Port 3000 is still in use by PID: $PORT_CHECK"
fi

echo ""
echo "📝 You can now start the server with: npm run dev"