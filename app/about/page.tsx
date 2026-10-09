import {company} from '@/lib/company';
export default function About() {
 return <section className="mx-auto max-w-2xl p-6 text-stone-900">
  <h1 className="mb-6 text-3xl">{company.displayName}</h1>
  <dl className="space-y-4"><div><dt className="font-semibold">Registered company</dt><dd>{company.name}</dd></div>
   <div><dt className="font-semibold">Registration number</dt><dd>{company.registrationNumber}</dd></div>
   <div><dt className="font-semibold">Website</dt><dd><a className="underline" href={company.website}>{company.website}</a></dd></div>
   <div><dt className="font-semibold">Business activity</dt><dd>{company.businessActivity}</dd></div>
  </dl>
 </section>;
}
