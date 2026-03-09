# Community Guidelines — clawbridge

## Publishing Public Agents

When you make an agent publicly accessible:

### Do
- Expose only read-only, safe skills (web_search, memory_search, session_status)
- Set rate limits to prevent abuse
- Monitor your agent's health and logs
- Respond to abuse reports promptly
- Document what your agent does and what data it accesses

### Don't
- Expose exec, Write, Edit, or other system-access tools publicly
- Share tokens in public channels (Discord, GitHub issues)
- Run without rate limiting on public networks
- Ignore failed auth attempts in your logs
- Expose private data through skill responses

## Security Best Practices

1. Generate strong tokens: `openssl rand -hex 32`
2. Use unique tokens per peer (not shared)
3. Set token expiry for temporary access
4. Rotate tokens regularly (monthly for production)
5. Use permissions.json to restrict skill access per peer
6. Put Caddy or nginx in front for TLS on public networks
7. Monitor /health and /metrics for anomalies
8. Review audit logs weekly

## Rate Limiting Etiquette

- Respect 429 responses — wait for the Retry-After period
- Don't retry immediately on rate limits
- Cache results when possible to reduce calls
- Contact the agent owner if you need higher limits

## Reporting Issues

- Security vulnerabilities: Email directly (don't post publicly)
- Bugs: GitHub Issues
- Abuse: Contact the agent owner, or open a GitHub issue

## Code of Conduct

- Be respectful in all interactions
- Don't use agents to harass, spam, or attack others
- Don't attempt to bypass security controls
- Share knowledge freely — that's what this project is about
- Help others set up and troubleshoot
