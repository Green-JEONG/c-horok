import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  visible?: boolean;
  variant?: "inline" | "overlay" | "viewport";
  className?: string;
  onClick?: () => void;
};

export default function InfiniteScrollDownHint({
  visible = true,
  variant = "inline",
  className = "",
  onClick,
}: Props) {
  if (!visible) {
    return null;
  }

  const icon = (
    <ChevronDown
      className="h-12 w-12 animate-bounce text-primary"
      strokeWidth={3}
      aria-hidden="true"
    />
  );

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background from-40% via-background/90 to-transparent pb-8 pt-20",
          className,
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto flex items-center justify-center rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="아래로 더 보기"
        >
          {icon}
        </button>
      </div>
    );
  }

  if (variant === "viewport") {
    return (
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-background from-40% via-background/90 to-transparent pb-8 pt-20",
          className,
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto flex items-center justify-center rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="아래로 더 보기"
        >
          {icon}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-10",
        className,
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center justify-center rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="아래로 더 보기"
        >
          {icon}
        </button>
      ) : (
        <div aria-hidden="true">{icon}</div>
      )}
    </div>
  );
}
