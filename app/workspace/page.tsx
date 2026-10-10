import { PageHeading } from '@/components/page-heading';
import { VisitorWorkspace } from '@/components/visitor-workspace';
export const metadata={title:'Workspace | One Fin Solution'};
export default function Workspace(){return <div className="page-wrap"><PageHeading eyebrow="YOUR WORKSPACE" title="Start with an idea." description="Chat for free without creating an account." /><VisitorWorkspace /></div>;}
