#!/bin/bash

# Load environment variables from .env file
export $(cat .env | xargs)

# Start the MCP server
npx tsx src/ai/dev.ts
