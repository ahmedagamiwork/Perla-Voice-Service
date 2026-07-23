import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { env } from '../src/config/env.js';

const client = new Client({ name: 'perla-smoke-test', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(`${env.PUBLIC_BASE_URL}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${env.VOICE_API_TOKEN}` } }
});
await client.connect(transport);
const tools = await client.listTools();
console.log('tools:', tools.tools.map(t => t.name).join(', '));
const result = await client.callTool({ name: 'search_products', arguments: { query: 'عش البلبل', limit: 3 } });
console.log(JSON.stringify(result, null, 2));
await client.close();
