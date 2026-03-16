#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== CÓDIGO GPS Release Assistant ===${NC}"
echo "This script will help you publish the repository to GitHub."

# 1. Check Remote
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$CURRENT_REMOTE" ]; then
    echo -e "${YELLOW}No remote 'origin' found.${NC}"
    read -p "Enter your GitHub Repository URL (e.g., https://github.com/USER/codigo-gps.git): " NEW_URL
    git remote add origin "$NEW_URL"
else
    echo -e "Current remote: ${YELLOW}$CURRENT_REMOTE${NC}"
    echo "If this is incorrect (e.g., wrong username), you should change it."
    read -p "Do you want to change the remote URL? (y/N) " CHANGE_REMOTE
    if [[ "$CHANGE_REMOTE" =~ ^[Yy]$ ]]; then
        read -p "Enter new GitHub URL: " NEW_URL
        git remote set-url origin "$NEW_URL"
        echo -e "${GREEN}Remote updated to: $NEW_URL${NC}"
    fi
fi

# 2. Verify Repo Existence (Instruction only)
echo -e "\n${YELLOW}IMPORTANT:${NC} Ensure you have created this repository on GitHub (empty)."
read -p "Press [Enter] when the repo exists and you are ready to push..."

# 3. Push Main
echo -e "\n${GREEN}>> Pushing 'main' branch...${NC}"
if git push -u origin main; then
    echo -e "${GREEN}Successfully pushed main.${NC}"
else
    echo -e "${RED}Failed to push main. Check your credentials and permissions.${NC}"
    exit 1
fi

# 4. Push Tags
echo -e "\n${GREEN}>> Pushing release tag (v0.1.0-mvp)...${NC}"
if git push origin v0.1.0-mvp; then
    echo -e "${GREEN}Successfully pushed tags.${NC}"
else
    echo -e "${RED}Failed to push tags.${NC}"
    # Don't exit, this is optional
fi

echo -e "\n${GREEN}=== SUCCESS! Project is live on GitHub ===${NC}"
