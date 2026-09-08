import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';

async function main() {
  const port = process.env.OSIRIS_DEXPI_MCP_PORT ? parseInt(process.env.OSIRIS_DEXPI_MCP_PORT, 10) : 45123;
  const server = createMcpServer(port);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('osiris-dexpi-mcp server running on stdio');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});

