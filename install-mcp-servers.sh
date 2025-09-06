bash <<'EOF'
echo "🔧  Claude MCP 서버 설치 (최신 버전)…"

# sequential-thinking
claude mcp add sequential-thinking -s user \
  -- npx -y @modelcontextprotocol/server-sequential-thinking || true

# filesystem
claude mcp add filesystem -s user \
  -- npx -y @modelcontextprotocol/server-filesystem \
     /Users/sooyeol/Documents /Users/sooyeol/Desktop /Users/sooyeol/Downloads || true

# Playwright
claude mcp add playwright -s user
  -- npx @executeautomation/playwright-mcp-server || true

# Fetch — 간단한 HTTP GET/POST
claude mcp add fetch -s user \
  -- npx -y @kazuph/mcp-fetch || true

# 브라우저 도구 — DevTools 로그, 스크린샷 등
claude mcp add browser-tools -s user \
  -- npx -y @agentdeskai/browser-tools-mcp || true

# context7 (최신 버전 제거, 기본 버전 사용)
claude mcp add context7 -s user \
  -- npx -y @upstash/context7-mcp || true

echo "--------------------------------------------------"
echo "✅  MCP 등록 완료."
echo ""
echo "🔴  브라우저 도구를 활성화하려면 *두 번째* 터미널에서 다음을 실행하고 열어두세요:"
echo "    npx -y @agentdeskai/browser-tools-server"
echo "--------------------------------------------------"
claude mcp list
EOF