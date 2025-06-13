'use client'

import Default from '@/app/components/default';
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Mic, Play, Square } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type PitchPoint = {
  time: number;
  frequency: number;
};

export default function Main() {
  const [chosenAudio, setChosenAudio] = useState('')
  const [chosenPhrase, setChosenPhrase] = useState('')
  const [audioChoice, setAudioChoice] = useState(0);
  const [testChoice, setTestChoice] = useState(0);


  const router = useRouter();
  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [alignedGraphData, setAlignedGraphData] = useState<any[]>([]);

  useEffect(() => {
    if (audioChoice === 0) {
      setChosenAudio('chinese_output.mp3');
      setChosenPhrase('mǎ 馬 马');
    } else if (audioChoice === 1) {
      setChosenAudio('chinese_phrase.mp3');
      setChosenPhrase('你好！你今天怎么样？');
    }
  }, [audioChoice]);


  const analyzeAudio = async (audio_blob: Blob, audio_location: string) => {
    const formData = new FormData();
    formData.append('file', audio_blob, audio_location);
    const result = await fetch('http://localhost:8000/analyze-audio', {
      method: 'POST',
      body: formData,
    });
    const data = await result.json();
    console.log('Pitch data:', data);
    return data
  };

  const DTW = async (userPitch: PitchPoint[], referencePitch: PitchPoint[]) => {
    const formData = new FormData();
    formData.append('data_reference', JSON.stringify({
      frequency: referencePitch.map(p => p.frequency),
      time: referencePitch.map(p => p.time)
    }));
    formData.append('data_user', JSON.stringify({
      frequency: userPitch.map(p => p.frequency),
      time: userPitch.map(p => p.time)
    }));
    const result = await fetch('http://localhost:8000/dtw', {
      method: 'POST',
      body: formData
    });
    const data = await result.json();
    console.log("DTW result:", data);
    setAlignedGraphData(data.aligned);
  };



  const handlePlay = async () => {
    const audio = new Audio(`/audio/${chosenAudio}`);
    audio.play();
    const response = await fetch(`/audio/${chosenAudio}`);
    const blob = await response.blob();
    const data = await analyzeAudio(blob, chosenAudio);
    //const normalizedUserPitch = normalizePitch(data.pitch);
    setReferencePitch(data.pitch);
  };


  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      const url = URL.createObjectURL(audioBlob);
      setAudioURL(url);
      const data = await analyzeAudio(audioBlob, 'recorded_audio.wav');
      //const normalizedUserPitch = normalizePitch(data.pitch);
      setUserPitch(data.pitch);
      DTW(data.pitch, referencePitch);
    };
    audioChunks.current = [];
    mediaRecorder.start();
    setRecording(true);
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };


  function countMatches(aligned: any[], tolerance = 15): number {
    let totalPoints = aligned.length;
    let correctPoints = 0;

    aligned.forEach(pair => {
      if (Math.abs(pair.user - pair.reference) < tolerance) {
        correctPoints += 1;
      }
    });
    return totalPoints > 0 ? correctPoints / totalPoints : 0;
  }


  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-screen text-[50px]">
      <header className='flex flex-cols text-white text-[22px] font-bold gap-3'>
        <button 
          className={`p-3 rounded-2xl ${audioChoice === 1 ? 'bg-yellow-500 hover:bg-yellow-600 w-30' : 'bg-white border border-2 border-yellow-500 text-yellow-500'}`} 
          onClick={() => setAudioChoice(0)}>
          Character
        </button>

        <button 
          className={`p-3 rounded-2xl ${audioChoice === 0 ? 'bg-yellow-500 hover:bg-yellow-600 w-30' : 'bg-white border border-2 border-yellow-500 text-yellow-500'}`} 
          onClick={() => setAudioChoice(1)}>
          Phrase
        </button>
      </header>

      <h1>{chosenPhrase}</h1>

      <div className="grid grid-cols-3 grid-rows-2 gap-4 w-full px-8 h-[600px]">

        <div className='flex justify-center items-center w-full h-full'>
          <button className="p-4 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
            <Play />
          </button>
          <button
            className={`p-4 rounded-full text-white ${recording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            onClick={recording ? stopRecording : startRecording}>
            {recording ? <Square /> : <Mic />}
          </button>
        </div>

        <Default
          referencePitch={referencePitch}
          alignedGraphData={alignedGraphData}
          countMatches={countMatches}
        />

        <div>
          {/* This is where the audio recording(s) should go */}
        </div>

        <Default
          referencePitch={referencePitch}
          alignedGraphData={alignedGraphData}
          countMatches={countMatches}
        />
      </div>
    </main>
  );
}

