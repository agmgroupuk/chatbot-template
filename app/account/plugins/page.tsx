import Link from 'next/link';
import { getUserModelSettings } from '@/app/actions';
import { ModelPreferences } from '@/components/model-preferences';
export default async function Plugins() {
  const settings=await getUserModelSettings();
  return <><section className="panel"><h2>Plugins & integrations</h2><p>Manage the tools available in your workspace.</p><div className="setting-row"><div><strong>Saved context</strong><p>Attach your own reference notes to a new conversation.</p><Link className="text-link" href="/context">Manage saved context</Link></div><span className="badge">Built in</span></div><div className="empty-state"><h3>Third-party plugins</h3><p>No third-party plugins are connected. External accounts and permissions will appear here when a supported connection is available.</p></div><Link className="text-link" href="/account/preferences">Configure built-in extensions →</Link></section><ModelPreferences enabled={settings.enabledModels} /></>;
}
