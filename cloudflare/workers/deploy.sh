#!/bin/bash

# Cloudflare Workers deployment script for Moneo

echo "🚀 Deploying Moneo to Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login to Cloudflare (if not already logged in)
echo "📝 Checking Cloudflare authentication..."
wrangler whoami || wrangler login

# Create KV namespace for caching
echo "💾 Creating KV namespace for caching..."
wrangler kv:namespace create KV_CACHE || echo "KV namespace already exists"

# Create R2 bucket for static assets
echo "📦 Creating R2 bucket for static assets..."
wrangler r2 bucket create moneo-assets || echo "R2 bucket already exists"

# Deploy worker
echo "🌐 Deploying worker..."
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update wrangler.toml with your actual KV and R2 IDs"
echo "2. Configure Cloudflare Access for authentication"
echo "3. Upload static assets to R2 bucket"
echo "4. Update DNS to point to Cloudflare Workers"
