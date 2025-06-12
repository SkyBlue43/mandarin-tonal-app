'use client'

import OneWord from '@/app/components/oneWord';
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { Mic, Play, Square } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type PitchPoint = {
  time: number;
  frequency: number;
};

export default function Main() {
  const router = useRouter();
  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [alignedGraphData, setAlignedGraphData] = useState<any[]>([]);

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
    const audio = new Audio('/audio/chinese_output.mp3');
    audio.play();
    const response = await fetch('/audio/chinese_output.mp3');
    const blob = await response.blob();
    const data = await analyzeAudio(blob, 'chinese_output.mp3');
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
      <h1>mǎ 馬 马</h1>
      <div className="grid grid-cols-3 grid-rows-2 gap-4 w-full px-8 h-[600px]">

        <OneWord
          referencePitch={referencePitch}
          alignedGraphData={alignedGraphData}
          handlePlay={handlePlay}
          startRecording={startRecording}
          stopRecording={stopRecording}
          recording={recording}
          countMatches={countMatches}
        />

        <OneWord
          referencePitch={referencePitch}
          alignedGraphData={alignedGraphData}
          handlePlay={handlePlay}
          startRecording={startRecording}
          stopRecording={stopRecording}
          recording={recording}
          countMatches={countMatches}
        />
      </div>
    </main>
  );
}

