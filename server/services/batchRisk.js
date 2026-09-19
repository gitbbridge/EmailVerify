import { getSupabaseAdmin } from './supabase.js'

export const batchRiskRules = {
  OVER_STANDARD_LIMIT: 'List exceeds the 50,000-address standard limit.',
  NEW_ACCOUNT_LARGE_BATCH: 'Account is under seven days old and the list exceeds 10,000 addresses.',
  FREE_CREDITS_ONLY: 'Workspace has not completed a paid credit purchase.',
  PAYMENT_PENDING: 'Workspace has a pending purchase or payment.',
  INVENTORY_EXPOSURE: 'Batch exceeds 10% of remaining sellable provider inventory.',
  REPEATED_LARGE_SUBMISSION: 'Multiple large jobs were submitted recently by this workspace or network.',
  PAYMENT_RISK_HISTORY: 'Workspace has a recent failed payment, refund, or dispute.',
  ABNORMAL_VOLUME: 'Requested volume is substantially above the workspace’s normal usage.',
}

export async function assessBatchRisk({ workspaceId, networkHash, total }) {
  const admin = getSupabaseAdmin()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const [workspaceResult, paidResult, pendingResult, inventoryResult, recentResult, paymentRiskResult, historyResult] = await Promise.all([
    admin.from('workspaces').select('created_at').eq('id', workspaceId).single(),
    admin.from('purchases').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'paid'),
    admin.from('purchases').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending'),
    admin.from('provider_inventory').select('sales_allocation,reported_available,allocated_to_customers,pending_checkout,safety_reserve').eq('provider', 'emailable').single(),
    admin.from('batches').select('id,workspace_id,network_hash').gt('total', 10000).gte('created_at', since24h).or(`workspace_id.eq.${workspaceId}${networkHash ? `,network_hash.eq.${networkHash}` : ''}`),
    admin.from('payment_risk_events').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', since90d),
    admin.from('batches').select('total').eq('workspace_id', workspaceId).eq('status', 'complete').order('created_at', { ascending: false }).limit(10),
  ])
  for (const result of [workspaceResult, paidResult, pendingResult, inventoryResult, recentResult, paymentRiskResult, historyResult]) if (result.error) throw result.error

  const rules = []
  const accountAge = Date.now() - new Date(workspaceResult.data.created_at).getTime()
  const inventory = inventoryResult.data
  const sellable = Math.max(0, Math.min(
    inventory.sales_allocation - inventory.allocated_to_customers - inventory.pending_checkout,
    inventory.reported_available - inventory.safety_reserve - inventory.allocated_to_customers - inventory.pending_checkout,
  ))
  const history = historyResult.data || []
  const average = history.length ? history.reduce((sum, batch) => sum + batch.total, 0) / history.length : 0

  if (total > 50000) rules.push('OVER_STANDARD_LIMIT')
  if (accountAge < 7 * 24 * 60 * 60 * 1000 && total > 10000) rules.push('NEW_ACCOUNT_LARGE_BATCH')
  if ((paidResult.count || 0) === 0) rules.push('FREE_CREDITS_ONLY')
  if ((pendingResult.count || 0) > 0) rules.push('PAYMENT_PENDING')
  if (sellable === 0 || total > sellable * 0.10) rules.push('INVENTORY_EXPOSURE')
  if ((recentResult.data || []).length > 0) rules.push('REPEATED_LARGE_SUBMISSION')
  if ((paymentRiskResult.count || 0) > 0) rules.push('PAYMENT_RISK_HISTORY')
  if (history.length >= 3 && total > 10000 && total > average * 3) rules.push('ABNORMAL_VOLUME')

  return { requiresApproval: rules.length > 0, rules, sellable, averageVolume: Math.round(average) }
}
