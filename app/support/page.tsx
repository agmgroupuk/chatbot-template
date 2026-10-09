import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { HelpCenter } from '@/components/help-center';
export const metadata = { title: 'Support / Help Center | One Fin Solution' };
export default function Support() { return <div className="page-wrap"><PageHeading eyebrow="SUPPORT / HELP CENTER" title="A little help goes a long way." description="Practical answers for your account, workspace, and plans. Find what you need and get back to your work." /><HelpCenter /><section className="callout section-space"><div><h2>Still need a hand?</h2><p>Tell us what happened. Include the error message, but keep passwords and payment details private.</p></div><Link className="button" href="/contact">Submit a request</Link></section><div className="button-row"><Link className="text-link" href="/dashboard/support">View my support requests</Link><Link className="text-link" href="/forgot-password">Recover my account</Link></div></div>; }
