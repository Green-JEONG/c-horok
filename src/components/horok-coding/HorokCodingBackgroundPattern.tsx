import Image from "next/image";

const rows = [
  { top: "0px", offset: "clamp(90px, 6vw, 130px)" },
  { top: "14%", offset: "0px" },
  { top: "28%", offset: "clamp(90px, 6vw, 130px)" },
  { top: "42%", offset: "0px" },
  { top: "56%", offset: "clamp(90px, 6vw, 130px)" },
  { top: "70%", offset: "0px" },
  { top: "84%", offset: "clamp(90px, 6vw, 130px)" },
  { top: "98%", offset: "0px" },
  { top: "112%", offset: "clamp(90px, 6vw, 130px)" },
] as const;

const columns = Array.from({ length: 24 }, (_, index) => index - 2);

export default function HorokCodingBackgroundPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {rows.flatMap((row) =>
        columns.map((column) => (
          <Image
            key={`${row.top}-${column}`}
            src="/logo.png"
            alt=""
            width={120}
            height={120}
            className="absolute h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 opacity-20 sm:h-[70px] sm:w-[70px]"
            style={{
              top: row.top,
              left: `calc(${row.offset} + ${column} * clamp(190px, 11.5vw, 240px))`,
            }}
          />
        )),
      )}
    </div>
  );
}
