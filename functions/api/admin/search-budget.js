/**
 * Search Budget Monitoring API
 *
 * GET /api/admin/search-budget - Get current budget status and recommendations
 * POST /api/admin/search-budget/test - Test search with specified provider
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { unifiedSearch, getBudgetReport, SearchPriority } from '../../_shared/search-providers.js';

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Get budget report
    const budget = await getBudgetReport(context.env);

    // Check which providers are configured
    const providers = {
      tavily: !!context.env.TAVILY_API_KEY,
      exa: !!context.env.EXA_API_KEY,
      brave: !!context.env.BRAVE_API_KEY
    };

    const configuredCount = Object.values(providers).filter(Boolean).length;

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      providers,
      configuredCount,
      budget,
      freeTierLimits: {
        tavily: {
          monthlyCredits: 1000,
          basicSearchCost: 1,
          advancedSearchCost: 2,
          resetsMonthly: true
        },
        exa: {
          totalCredits: 1000,
          searchCost: '~1 credit',
          resetsMonthly: false,
          note: 'Finite credits - reserve for high-value searches'
        }
      },
      strategy: {
        primary: 'Tavily (resets monthly)',
        fallback: 'Exa (finite credits)',
        legacy: 'Brave (if configured)',
        caching: '24-hour cache in KV',
        dailyBudget: '~30 searches/day to stay on free tier'
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Search budget error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(context.request.url);
    const action = url.pathname.split('/').pop();

    if (action === 'test') {
      const body = await context.request.json();
      const { query, provider, priority = 'normal' } = body;

      if (!query) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Query is required'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Map priority string to enum
      const priorityMap = {
        critical: SearchPriority.CRITICAL,
        high: SearchPriority.HIGH,
        normal: SearchPriority.NORMAL,
        low: SearchPriority.LOW
      };

      const searchResult = await unifiedSearch(query, context.env, {
        priority: priorityMap[priority] || SearchPriority.NORMAL,
        maxResults: 5,
        forceProvider: provider || null
      });

      return new Response(JSON.stringify({
        success: true,
        test: true,
        query,
        priority,
        requestedProvider: provider || 'auto',
        result: searchResult
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown action'
    }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Search budget POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
