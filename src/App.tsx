import { useState } from 'react'
import warning from './assets/horok_warning.png'
import skeleton1 from './assets/skeleton1.png'
import skeleton2 from './assets/skeleton2.png'
import skeleton3 from './assets/skeleton3.png'
import skeleton4 from './assets/skeleton4.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#ECFAE5]">
      {/* 알림창 프레임 */}
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col items-center w-[1500px] h-[892px]">

      {/* 🔲 상단 바 (닫기/확대 버튼) */}
      <div className="flex items-center justify-between w-[1500px] h-[100px] bg-[#374851] rounded-t-2xl px-10">
        <div className="flex gap-3">
          <button className="w-[30px] h-[30px] rounded-full bg-red-500 hover:bg-red-600" />
          <button className="w-[30px] h-[30px] rounded-full bg-yellow-400 hover:bg-yellow-500" />
          <button className="w-[30px] h-[30px] rounded-full bg-green-500 hover:bg-green-600" />
        </div>
      </div>

      {/* 본문 콘텐츠 */}
      {/* 타이틀 */}
      <h1 className="text-8xl font-goorm text-[#0A400C] mt-24 mb-12">
          호록이는 단장 중!
      </h1>

      {/* 설명 */}
      <p className='text-2xl font-goorm text-[#0A400C]'>
          곧 초록 호랑이의 모습이 드러납니다..
      </p>

      <div className="relative w-full flex justify-center items-center">
        {/* 경고 이미지 */}
        <img
          src={warning}
          alt="horok_warning"
          className="absolute z-20 mb-[4rem]"
        />

        {/* 스켈레톤 이미지들 */}
        <div className="flex items-center justify-center gap-14 z-10 mt-52">
          <img src={skeleton1} alt="skeleton_component1" />
          <img src={skeleton2} alt="skeleton_component2" />
          <img src={skeleton3} alt="skeleton_component3" />
          <img src={skeleton4} alt="skeleton_component4" />
        </div>
      </div>
    </div>
  </div>
  )
}

export default App
