'use client'

import { useState, useRef } from 'react'
import { Mic, Play, Square, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Home() {
  type PitchPoint = {
    time: number;
    frequency: number;
  };

  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

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


  const handlePlay = async () => {
    const audio = new Audio('/audio/3rd_tone_ma.wav');
    audio.play();
    const response = await fetch('/audio/3rd_tone_ma.wav');
    const blob = await response.blob();
    const data = await analyzeAudio(blob, '3rd_tone_ma.wav');
    setReferencePitch(data.pitch);
  };

  const handleReplay = () => {
    if (!audioURL) return;
  
    const audio = new Audio(audioURL);
    audio.play();
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
      setUserPitch(data.pitch);
    };
    audioChunks.current = [];
    mediaRecorder.start();
    setRecording(true);
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const mergedPitchData = userPitch.map((point, index) => ({
    time: point.time,
    user: point.frequency,
    reference: referencePitch[index]?.frequency ?? 0,  // handle mismatch
  }));
  


  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-screen text-[50px]">
      <h1>mǎ 馬</h1>
      <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full px-8 h-[600px]">

        <div className='flex justify-center items-center w-full h-full'>
          <button className="p-4 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
          <Play />
        </button>
        </div>

        <div>{referencePitch.length > 0 && (
          <LineChart width={400} height={300} data={referencePitch}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }}/>
            <YAxis tick={{ fontSize: 14 }}/>
            <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
          </LineChart>
        )}</div>

        <div className='flex justify-center items-center w-full h-full'>
          <button
          className={`p-4 rounded-full text-white ${recording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          onClick={recording ? stopRecording : startRecording}>
          {recording ? <Square /> : <Mic />}
        </button>
        
        {audioURL && (
    <button
      className="p-4 rounded-full bg-yellow-500 text-white hover:bg-yellow-600"
      onClick={() => {
        const audio = new Audio(audioURL);
        audio.play();
      }}
    >
      <RotateCcw />
    </button>
  )}
        {audioURL && <audio controls src={audioURL} />}
        </div>

        <div>{userPitch.length > 0 && (
          <LineChart width={400} height={300} data={mergedPitchData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }}/>
            <YAxis tick={{ fontSize: 14 }}/>
            <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5}/>
            <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5}/>
          </LineChart>
        )}</div>
      </div>
    </main>
  );
}

