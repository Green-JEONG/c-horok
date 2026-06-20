import { EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function getTitleStatusIndent(
  showHidden: boolean,
  showSecret: boolean,
) {
  if (!showHidden && !showSecret) {
    return undefined;
  }

  if (showHidden && showSecret) {
    return "3.875rem";
  }

  return "1.875rem";
}

export default function PostTitleStatusIcons({
  showHidden = false,
  showSecret = false,
  iconClassName = "h-6 w-6",
  className,
}: {
  showHidden?: boolean;
  showSecret?: boolean;
  iconClassName?: string;
  className?: string;
}) {
  if (!showHidden && !showSecret) {
    return null;
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      {showHidden ? (
        <EyeOff
          className={cn("shrink-0 text-muted-foreground", iconClassName)}
          aria-hidden="true"
        />
      ) : null}
      {showSecret ? (
        <Lock
          className={cn("shrink-0 text-muted-foreground", iconClassName)}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
