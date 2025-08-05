// import { useState } from 'react'
import warning from './assets/horok_warning.png'
import skeleton1 from './assets/skeleton1.png'
import skeleton2 from './assets/skeleton2.png'
import skeleton3 from './assets/skeleton3.png'
import skeleton4 from './assets/skeleton4.png'
import './App.css'

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#ECFAE5] px-4">
      {/* 알림창 프레임 */}
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col items-center w-full max-w-[1500px] h-[90vh] relative">

        {/* 🔲 상단 바 */}
        <div className="flex items-center justify-between w-full h-[70px] md:h-[80px] lg:h-[100px] bg-[#374851] rounded-t-2xl px-6 md:px-10">
          <div className="flex gap-3">
            <button className="w-[20px] h-[20px] md:w-[25px] md:h-[25px] lg:w-[30px] lg:h-[30px] rounded-full bg-red-500 hover:bg-red-600" />
            <button className="w-[20px] h-[20px] md:w-[25px] md:h-[25px] lg:w-[30px] lg:h-[30px] rounded-full bg-yellow-400 hover:bg-yellow-500" />
            <button className="w-[20px] h-[20px] md:w-[25px] md:h-[25px] lg:w-[30px] lg:h-[30px] rounded-full bg-green-500 hover:bg-green-600" />
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <h1 className="text-5xl md:text-6xl lg:text-8xl font-goorm text-[#0A400C] mt-20 md:mt-20 mb-12 md:mb-12 text-center">
          호록이는 단장 중!
        </h1>

        <p className="text-base md:text-xl lg:text-2xl font-goorm text-[#0A400C] text-center px-4">
          곧 초록 호랑이의 본 모습이 드러납니다..
        </p>

        <div className="relative w-full flex justify-center items-center mt-24 md:mt-32 lg:mt-36">
          {/* 경고 이미지 */}
          <img
            src={warning}
            alt="horok_warning"
            className="absolute z-20 w-[350px] md:w-[400px] lg:w-[500px] top-8 md:top-6 lg:-top-16"
          />

          {/* 스켈레톤 이미지들 */}
          <div className="flex items-center justify-center gap-4 md:gap-8 lg:gap-10 px-4 w-full mt-[13rem] md:mt-[8rem] lg:mt-[3rem]">
            <img
              src={skeleton1}
              alt="skeleton1"
              className="w-[22%] max-w-[300px] min-w-[70px] object-contain"
            />
            <img
              src={skeleton2}
              alt="skeleton2"
              className="w-[22%] max-w-[300px] min-w-[70px] object-contain"
            />
            <img
              src={skeleton3}
              alt="skeleton3"
              className="w-[22%] max-w-[300px] min-w-[70px] object-contain"
            />
            <img
              src={skeleton4}
              alt="skeleton4"
              className="w-[22%] max-w-[300px] min-w-[70px] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}


export default App
