import Link from "next/link";
import { IdeInterfaceComponent } from "@/components/ide-interface";

export default function Home() {
  return (
    <div className="flex-1">
      <IdeInterfaceComponent />
      <p className="text-center text-xs text-stone-500"><Link href="/about" className="underline">Company One Fin Solution Co., Ltd.</Link></p>
    </div>
  );
}
