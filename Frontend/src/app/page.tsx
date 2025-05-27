'use client'

import { useState, useRef } from 'react'
import { Mic, Play, Square } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Home() {
  const [pitchData, setPitchData] = useState([]);
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
    setPitchData(data.pitch);
  };


  const handlePlay = async () => {
    const audio = new Audio('/audio/3rd_tone_ma.wav');
    audio.play();
    const response = await fetch('/audio/3rd_tone_ma.wav');
    const blob = await response.blob();
    analyzeAudio(blob, '3rd_tone_ma.wav');
  };


  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      const url = URL.createObjectURL(audioBlob);
      setAudioURL(url);
      analyzeAudio(audioBlob, 'recorded_audio.wav');
    };
    audioChunks.current = [];
    mediaRecorder.start();
    setRecording(true);
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };


  return (
    <main className="flex flex-col items-center justify-center h-screen text-[50px]">
      <h1>mǎ 馬</h1>
      <div className="grid grid-cols-2 gap-4">
        <div><button className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
          <Play />
        </button>
        </div>
        {pitchData.length > 0 && (
          <LineChart width={600} height={300} data={pitchData}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} />
          </LineChart>
        )}
        <div><button
          className={`p-4 rounded-full text-white ${recording ? 'bg-red-500' : 'bg-green-500'
            }`}
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? <Square /> : <Mic />}
        </button></div>
        {audioURL && (
          <audio controls src={audioURL} className="mt-4" />
        )}
        <div></div>
      </div>
    </main>
  );
}

