import ErrorState from "@/components/common/ErrorState";
import HorokCodingBackgroundPattern from "@/components/horok-coding/HorokCodingBackgroundPattern";

export default function HorokCodingNotFound() {
  return (
    <main className="relative h-dvh overflow-hidden bg-[#06923E] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <HorokCodingBackgroundPattern />
      <div className="relative flex h-full w-full flex-col">
        <section className="flex h-full min-h-0 flex-col rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-[#020617] dark:shadow-[0_22px_60px_rgba(2,6,23,0.45)] sm:p-6">
          <ErrorState
            code={404}
            message="요청하신 페이지를 찾을 수 없습니다. 주소가 올바른지 확인해 주세요."
            className="min-h-0 flex-1 px-0 py-0"
            contentClassName="rounded-[28px] bg-white px-6 py-10 dark:bg-[#020617]"
            codeClassName="text-[#06923E] dark:text-[#46c86f]"
            retryClassName="bg-[#06923E] text-white dark:bg-[#46c86f] dark:text-slate-950"
          />
        </section>
      </div>
    </main>
  );
}
