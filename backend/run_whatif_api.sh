#!/bin/bash

# Script to run the What-If Scene API with Gemini integration

echo "🚀 Starting What-If Scene API with Gemini AI..."

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY not set!"
    echo "   The API will use fallback rule-based modifications."
    echo ""
    echo "   To enable AI-powered scene modifications with Gemini:"
    echo "   export GEMINI_API_KEY='your-api-key-here'"
    echo ""
else
    echo "✅ Gemini API key found. AI features enabled."
fi

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    echo "📦 Activating virtual environment..."
    source .venv/bin/activate
fi

# Install/upgrade required packages
echo "📦 Checking dependencies..."
pip install -q google-generativeai pyyaml fastapi uvicorn

# Run the API
echo "🌐 Starting API on http://localhost:8101"
echo "   Endpoints:"
echo "   - POST /api/studio/whatif/scene/create    - Create what-if branch"
echo "   - POST /api/studio/whatif/scene/preview   - Preview changes"
echo "   - GET  /api/studio/whatif/scene/{id}/branches - List branches"
echo ""

python whatif_scene_api.py