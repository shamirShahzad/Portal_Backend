#!/bin/bash

# Manager Approval System Test Script
# This script demonstrates the complete manager approval workflow

echo "🚀 Testing Manager Approval System"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="http://localhost:3000/api/v1"

# Test application ID (you'll need to replace this with a real one)
APPLICATION_ID="e3555668-2f75-4854-9f11-ed8808950f9a"

echo -e "${BLUE}Step 1: Testing Manager Notification Endpoint${NC}"
echo "================================================"

# Send manager notification
NOTIFICATION_RESPONSE=$(curl -s -X POST "$BASE_URL/manager-approval/$APPLICATION_ID/send-notification" \
  -H "Content-Type: application/json" \
  -d '{
    "manager_email": "manager@company.com",
    "manager_name": "John Manager",
    "applicant_name": "Jane Doe", 
    "course_title": "Advanced JavaScript Training"
  }')

echo "Response:"
echo "$NOTIFICATION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$NOTIFICATION_RESPONSE"

# Extract token from response (if successful)
TOKEN=$(echo "$NOTIFICATION_RESPONSE" | grep -o '"approval_token":"[^"]*"' | cut -d'"' -f4)
APPROVAL_URL=$(echo "$NOTIFICATION_RESPONSE" | grep -o '"approval_url":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ Manager notification sent successfully!${NC}"
    echo -e "${YELLOW}Token: $TOKEN${NC}"
    echo -e "${YELLOW}Approval URL: $APPROVAL_URL${NC}"
    
    echo -e "\n${BLUE}Step 2: Testing Application Review Endpoint${NC}"
    echo "============================================="
    
    # Get application for review
    REVIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/manager-approval/$APPLICATION_ID/review?token=$TOKEN")
    
    echo "Response:"
    echo "$REVIEW_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REVIEW_RESPONSE"
    
    # Check if review was successful
    if echo "$REVIEW_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Application review endpoint working!${NC}"
        
        echo -e "\n${BLUE}Step 3: Testing Manager Approval Submission${NC}"
        echo "==========================================="
        
        # Submit approval
        APPROVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/manager-approval/$APPLICATION_ID/approve" \
          -H "Content-Type: application/json" \
          -d "{
            \"token\": \"$TOKEN\",
            \"manager_approval\": true,
            \"manager_notes\": \"Application approved. Employee demonstrates strong technical foundation and commitment to learning.\",
            \"reviewed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
          }")
        
        echo "Response:"
        echo "$APPROVAL_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$APPROVAL_RESPONSE"
        
        if echo "$APPROVAL_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ Manager approval submitted successfully!${NC}"
        else
            echo -e "${RED}❌ Manager approval submission failed${NC}"
        fi
    else
        echo -e "${RED}❌ Application review endpoint failed${NC}"
    fi
else
    echo -e "${RED}❌ Manager notification failed${NC}"
fi

echo -e "\n${BLUE}Step 4: Testing Frontend Page${NC}"
echo "==============================="

if [ -n "$APPROVAL_URL" ]; then
    echo -e "${YELLOW}You can now test the manager approval page by visiting:${NC}"
    echo -e "${GREEN}$APPROVAL_URL${NC}"
    echo ""
    echo "This page will allow managers to:"
    echo "• View application details"
    echo "• See uploaded documents"
    echo "• Submit approval/rejection with notes"
else
    echo -e "${RED}❌ No approval URL available to test${NC}"
fi

echo -e "\n${BLUE}Step 5: Database Verification${NC}"
echo "==============================="
echo "You can verify the results in your database with these queries:"
echo ""
echo "-- Check manager approval tokens:"
echo "SELECT * FROM manager_approval_tokens ORDER BY created_at DESC LIMIT 5;"
echo ""
echo "-- Check application status:"
echo "SELECT id, status, manager_approval, manager_notes FROM applications WHERE id = '$APPLICATION_ID';"
echo ""
echo "-- Check status history:"
echo "SELECT * FROM application_status_history WHERE application_id = '$APPLICATION_ID' ORDER BY changed_at DESC;"

echo -e "\n${GREEN}🎉 Manager Approval System Test Complete!${NC}"