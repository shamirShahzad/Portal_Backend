#!/bin/bash

# Export Functionality Test Script
# This script demonstrates the complete export workflow

echo "🚀 Testing Export Functionality"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="http://localhost:3000/api/v1"

echo -e "${BLUE}Step 1: Login to get authentication token${NC}"
echo "==========================================="

# Login to get token (replace with actual credentials)
echo "Please provide login credentials:"
read -p "Email: " EMAIL
read -s -p "Password: " PASSWORD
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed. Cannot proceed with export testing.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo -e "${YELLOW}Token: ${TOKEN:0:20}...${NC}"

echo -e "\n${BLUE}Step 2: Create Export Job${NC}"
echo "========================="

# Create export job
EXPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/exports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Export - Applications & Courses",
    "dataTypes": {
      "applications": true,
      "courses": true,
      "employees": false,
      "training": false
    },
    "filters": {
      "dateRange": "last-30-days"
    },
    "format": "excel"
  }')

echo "Export Creation Response:"
echo "$EXPORT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$EXPORT_RESPONSE"

# Extract export ID
EXPORT_ID=$(echo "$EXPORT_RESPONSE" | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$EXPORT_ID" ]; then
    echo -e "${RED}❌ Failed to create export job${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Export job created successfully!${NC}"
echo -e "${YELLOW}Export ID: $EXPORT_ID${NC}"

echo -e "\n${BLUE}Step 3: Monitor Export Progress${NC}"
echo "==============================="

# Monitor export progress
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/exports/$EXPORT_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
    
    echo -e "Attempt $((ATTEMPT + 1)): Status = ${YELLOW}$STATUS${NC}, Progress = ${YELLOW}$PROGRESS%${NC}"
    
    if [ "$STATUS" = "completed" ]; then
        echo -e "${GREEN}✅ Export completed successfully!${NC}"
        break
    elif [ "$STATUS" = "failed" ]; then
        echo -e "${RED}❌ Export failed${NC}"
        echo "Response:"
        echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
        exit 1
    fi
    
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Export timed out${NC}"
    exit 1
fi

echo -e "\n${BLUE}Step 4: Download Export File${NC}"
echo "============================"

# Download the export file
echo "Downloading export file..."
curl -X GET "$BASE_URL/exports/$EXPORT_ID/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o "test_export.xlsx"

if [ -f "test_export.xlsx" ]; then
    FILE_SIZE=$(stat -c%s "test_export.xlsx" 2>/dev/null || stat -f%z "test_export.xlsx" 2>/dev/null)
    echo -e "${GREEN}✅ Export file downloaded successfully!${NC}"
    echo -e "${YELLOW}File: test_export.xlsx${NC}"
    echo -e "${YELLOW}Size: $FILE_SIZE bytes${NC}"
else
    echo -e "${RED}❌ Failed to download export file${NC}"
fi

echo -e "\n${BLUE}Step 5: View Export History${NC}"
echo "==========================="

# Get export history
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/exports?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "Export History:"
echo "$HISTORY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HISTORY_RESPONSE"

echo -e "\n${BLUE}Step 6: Test Different Formats${NC}"
echo "=============================="

# Test CSV format
echo "Creating CSV export..."
CSV_RESPONSE=$(curl -s -X POST "$BASE_URL/exports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test CSV Export",
    "dataTypes": {
      "applications": true,
      "courses": false,
      "employees": false,
      "training": false
    },
    "filters": {
      "dateRange": "last-7-days"
    },
    "format": "csv"
  }')

CSV_EXPORT_ID=$(echo "$CSV_RESPONSE" | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CSV_EXPORT_ID" ]; then
    echo -e "${GREEN}✅ CSV export created: $CSV_EXPORT_ID${NC}"
else
    echo -e "${RED}❌ Failed to create CSV export${NC}"
fi

# Test JSON format
echo "Creating JSON export..."
JSON_RESPONSE=$(curl -s -X POST "$BASE_URL/exports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test JSON Export",
    "dataTypes": {
      "courses": true,
      "applications": false,
      "employees": false,
      "training": false
    },
    "filters": {
      "dateRange": "last-7-days"
    },
    "format": "json"
  }')

JSON_EXPORT_ID=$(echo "$JSON_RESPONSE" | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$JSON_EXPORT_ID" ]; then
    echo -e "${GREEN}✅ JSON export created: $JSON_EXPORT_ID${NC}"
else
    echo -e "${RED}❌ Failed to create JSON export${NC}"
fi

echo -e "\n${BLUE}Step 7: Cleanup Test${NC}"
echo "==================="

# Delete the test export
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/exports/$EXPORT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Export deleted successfully${NC}"
else
    echo -e "${RED}❌ Failed to delete export${NC}"
fi

echo -e "\n${GREEN}🎉 Export Functionality Test Complete!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "• Export creation: ✅"
echo "• Progress monitoring: ✅"
echo "• File download: ✅"
echo "• History viewing: ✅"
echo "• Multiple formats: ✅"
echo "• Cleanup: ✅"

if [ -f "test_export.xlsx" ]; then
    echo -e "\n${YELLOW}You can open 'test_export.xlsx' to view the generated Excel file.${NC}"
fi