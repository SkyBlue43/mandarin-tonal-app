'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { Mic, Play, Square } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function NextPage() {
  type PitchPoint = {
    time: number;
    frequency: number;
  };
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
    const audio = new Audio('/audio/portuguese_output.mp3');
    audio.play();
    const response = await fetch('/audio/portuguese_output.mp3');
    const blob = await response.blob();
    const data = await analyzeAudio(blob, 'portuguese_output.mp3');
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
      <h1>Sou muito grato para você</h1>
      <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full px-8 h-[600px]">

        <div className='flex justify-center items-center w-full h-full'>
          <button className="p-4 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
            <Play />
          </button>
        </div>

        <div>{referencePitch.length > 0 && (
          <LineChart width={700} height={300} data={referencePitch}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} />
            <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
          </LineChart>
        )}</div>

        <div className='flex justify-center items-center w-full h-full'>
          <button
            className={`p-4 rounded-full text-white ${recording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            onClick={recording ? stopRecording : startRecording}>
            {recording ? <Square /> : <Mic />}
          </button></div>

        <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
          <>
            <LineChart width={700} height={300} data={alignedGraphData}>
              <XAxis dataKey="time" tick={{ fontSize: 14 }} />
              <YAxis tick={{ fontSize: 14 }} />
              <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
              <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
            </LineChart>
            <p className="text-lg mt-2 text-center text-white">
              You were {(countMatches(alignedGraphData) * 100).toFixed(1)}% accurate!
            </p>
            <div>
              {(countMatches(alignedGraphData) * 100) > 90 && (
                <button className='bg-green-500 p-4 text-lg text-center rounded-3xl' onClick={() => router.push('/nextPage')}>
                  Success! Next?
                </button>
              )}</div>
          </>
        )}</div>
      </div>
    </main>
  );
}