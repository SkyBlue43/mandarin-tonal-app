'use client'

import { Mic, Play } from 'lucide-react';

export default function Home() {


  const analyzeAudio = async () => {
    const response = await fetch('/audio/3rd_tone_example_ma.wav');
    const blob = await response.blob();
  
    const formData = new FormData();
    formData.append('file', blob, '3rd_tone_example_ma.wav');
  
    const result = await fetch('http://localhost:8000/analyze-audio', {
      method: 'POST',
      body: formData,
    });
  
    const data = await result.json();
    console.log('Pitch data:', data);
  };
  

  const handlePlay = () => {
    const audio = new Audio('/audio/3rd_tone_example_ma.wav');
    audio.play();
    analyzeAudio();
  };


  return (
    <main className="flex flex-col items-center justify-center h-screen text-[50px]">
      <h1>mǎ 馬</h1>
      <div className="grid grid-cols-2 gap-4">
        <div><button className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
          <Play />
        </button>
        </div>
        <div></div>
        <div><button className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 items-center justify-center">
          <Mic />
        </button></div>
        <div></div>
      </div>
    </main>
  );
}

