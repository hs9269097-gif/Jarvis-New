import type { ReactNode } from "react";
import { SectionHeader } from "../components/ui";
import type { IconName } from "../components/icons";

export function Frame({ icon, title, subtitle, right, children }: { icon: IconName; title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-3 pt-16 pb-32 sm:px-6 md:pb-24">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} right={right} />
      <div className="glass corner relative min-h-0 flex-1 overflow-hidden rounded-xl">
        <div className="h-full overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
