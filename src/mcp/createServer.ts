import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { env } from '../config/env.js';
import { getBranch, getPolicies, getProductByCode, listBranches, listCategories, listPublicLinks, searchProducts } from '../repositories/catalogRepository.js';
import { createServiceRequest } from '../services/requestService.js';
import { createOrderDraft } from '../services/draftService.js';
import { auditToolCall } from '../services/auditService.js';

function toolResult(data: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {})
  };
}

function friendlyToolError(error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (code === 'INVALID_PHONE') return { error: code, message_ar: 'رقم الجوال غير صالح.' };
  if (code === 'EMPTY_ITEMS') return { error: code, message_ar: 'لا توجد منتجات صالحة في المسودة.' };
  if (code === 'INVALID_QUANTITY') return { error: code, message_ar: 'الكمية غير صالحة.' };
  if (code.startsWith('PRODUCT_NOT_FOUND:')) return { error: 'PRODUCT_NOT_FOUND', product_code: code.split(':')[1], message_ar: 'أحد المنتجات غير موجود أو غير نشط.' };
  return { error: 'TOOL_ERROR', message_ar: 'تعذر تنفيذ العملية. حوّل العميل إلى موظف عند الحاجة.' };
}

async function withAudit<T>(toolName: string, args: unknown, fn: () => Promise<T>): Promise<ReturnType<typeof toolResult>> {
  const started = Date.now();
  try {
    const data = await fn();
    await auditToolCall({
      toolName,
      clientLabel: 'xai_voice_agent',
      success: true,
      durationMs: Date.now() - started,
      args,
      resultSummary: Array.isArray(data) ? { count: data.length } : { returned: Boolean(data) }
    });
    return toolResult(data);
  } catch (error) {
    await auditToolCall({
      toolName,
      clientLabel: 'xai_voice_agent',
      success: false,
      durationMs: Date.now() - started,
      args,
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'UNKNOWN_ERROR'
    });
    return toolResult(friendlyToolError(error), true);
  }
}

export function createPerlaMcpServer(): McpServer {
  const server = new McpServer({ name: 'perla-voice-catalog', version: '1.0.1' });

  server.registerTool('search_products', {
    title: 'البحث في منتجات بيرلا',
    description: 'ابحث في كتالوج بيرلا الرسمي بالاسم أو الاسم الشائع، أو مرّر category لعرض كل منتجات تصنيف كامل (مثلاً كل "المعجنات" أو كل "الحلويات الشرقية"). استخدم list_categories أولاً لمعرفة الاسم الدقيق للتصنيف. يعيد السعر الموحد ووحدة البيع وحالة التوفر إن كانت محدثة.',
    inputSchema: {
      query: z.string().min(1).max(120).describe('اسم المنتج أو جزء منه باللغة العربية'),
      category: z.string().max(120).optional().describe('التصنيف عند الحاجة'),
      branch_code: z.enum(['ALKHARJ', 'DILAM']).optional().describe('رمز الفرع لمعرفة التوفر فقط؛ السعر موحد'),
      limit: z.number().int().min(1).max(10).default(5)
    }
  }, async args => withAudit('search_products', args, async () => {
    const products = await searchProducts(args.query, {
      category: args.category,
      branchCode: args.branch_code,
      limit: args.limit
    });
    return {
      currency: 'SAR',
      prices_unified_across_branches: true,
      products,
      availability_rule_ar: 'إذا كانت حالة التوفر unknown فلا تعد العميل بالتوفر، واطلب تأكيد الموظف.'
    };
  }));

  server.registerTool('get_product', {
    title: 'تفاصيل منتج بيرلا',
    description: 'يعيد تفاصيل منتج محدد باستخدام رمز المنتج الرسمي.',
    inputSchema: {
      product_code: z.string().min(1).max(40),
      branch_code: z.enum(['ALKHARJ', 'DILAM']).optional()
    }
  }, async args => withAudit('get_product', args, async () => {
    const product = await getProductByCode(args.product_code, args.branch_code);
    return product ?? { found: false, message_ar: 'المنتج غير موجود أو غير نشط.' };
  }));

  server.registerTool('list_categories', {
    title: 'تصنيفات منتجات بيرلا',
    description: 'يعيد تصنيفات الكتالوج وعدد المنتجات الفعالة في كل تصنيف.',
    inputSchema: {}
  }, async args => withAudit('list_categories', args, listCategories));

  server.registerTool('list_branches', {
    title: 'فروع بيرلا',
    description: 'يعيد الفروع الفعالة. لا تخمّن أرقام الهاتف أو العناوين غير المسجلة.',
    inputSchema: {}
  }, async args => withAudit('list_branches', args, listBranches));

  server.registerTool('get_branch', {
    title: 'بيانات فرع بيرلا',
    description: 'يعيد بيانات فرع الخرج أو الدلم ومواعيد العمل المسجلة.',
    inputSchema: { branch_code: z.enum(['ALKHARJ', 'DILAM']) }
  }, async args => withAudit('get_branch', args, async () => {
    const branch = await getBranch(args.branch_code);
    return branch ?? { found: false, message_ar: 'الفرع غير موجود.' };
  }));

  server.registerTool('get_business_policy', {
    title: 'سياسات بيرلا',
    description: 'يعيد السياسات المعتمدة فقط، مثل تأكيد الطلب أو الأسعار. لا تخمّن سياسة غير مسجلة.',
    inputSchema: { policy_key: z.string().max(80).optional() }
  }, async args => withAudit('get_business_policy', args, () => getPolicies(args.policy_key)));


  server.registerTool('get_official_links', {
    title: 'الروابط الرسمية لبيرلا',
    description: 'يعيد الروابط الرسمية المعتمدة لبيرلا، ومنها الرابط الموحد للحسابات والقنوات. استخدم الرابط المعاد فقط ولا تخمّن أي حساب اجتماعي.',
    inputSchema: {
      link_type: z.enum(['official_hub','whatsapp','instagram','tiktok','snapchat','map','ordering','general']).optional()
    }
  }, async args => withAudit('get_official_links', args, () => listPublicLinks(args.link_type)));

  if (env.ENABLE_WRITE_TOOLS) {
    server.registerTool('create_service_request', {
      title: 'إنشاء طلب متابعة',
      description: 'يسجل طلب متابعة أو شكوى ليعالجها موظف بشري. لا يُعد تأكيد طلب بيع.',
      inputSchema: {
        branch_code: z.enum(['ALKHARJ', 'DILAM']).optional(),
        request_type: z.enum(['callback', 'complaint', 'custom_cake', 'large_order', 'general_followup']),
        customer_name: z.string().max(160).optional(),
        customer_phone: z.string().min(9).max(30),
        details_ar: z.string().min(3).max(2000)
      }
    }, async args => withAudit('create_service_request', args, () => createServiceRequest({
      branchCode: args.branch_code,
      requestType: args.request_type,
      customerName: args.customer_name,
      customerPhone: args.customer_phone,
      detailsAr: args.details_ar
    })));

    server.registerTool('create_order_draft', {
      title: 'إنشاء مسودة طلب بيرلا',
      description: 'ينشئ مسودة محسوبة من الأسعار الرسمية. المسودة ليست طلبًا مؤكدًا ويجب أن يراجعها موظف.',
      inputSchema: {
        branch_code: z.enum(['ALKHARJ', 'DILAM']).optional(),
        customer_name: z.string().max(160).optional(),
        customer_phone: z.string().min(9).max(30),
        fulfillment_type: z.enum(['pickup', 'delivery']).default('pickup'),
        requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        requested_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        delivery_address: z.string().max(500).optional(),
        notes_ar: z.string().max(2000).optional(),
        items: z.array(z.object({
          product_code: z.string().min(1).max(40),
          quantity: z.number().positive().max(1000),
          notes_ar: z.string().max(500).optional()
        })).min(1).max(30)
      }
    }, async args => withAudit('create_order_draft', args, () => createOrderDraft({
      branchCode: args.branch_code,
      customerName: args.customer_name,
      customerPhone: args.customer_phone,
      fulfillmentType: args.fulfillment_type,
      requestedDate: args.requested_date,
      requestedTime: args.requested_time,
      deliveryAddress: args.delivery_address,
      notesAr: args.notes_ar,
      items: args.items.map(i => ({ productCode: i.product_code, quantity: i.quantity, notesAr: i.notes_ar }))
    })));
  }

  return server;
}
