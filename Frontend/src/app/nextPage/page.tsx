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
    const audio = new Audio('/audio/chinese_output.mp3');
    audio.play();
    const response = await fetch('/audio/chinese_output.mp3');
    const blob = await response.blob();
    const data = await analyzeAudio(blob, 'chinese_output.mp3');
    const normalizedUserPitch = normalizePitch(data.pitch);
    setReferencePitch(normalizedUserPitch);
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
      const normalizedUserPitch = normalizePitch(data.pitch);
      setUserPitch(normalizedUserPitch);
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
    reference: referencePitch[index]?.frequency ?? undefined,  // handle mismatch
  }));

  const normalizePitch = (pitchData: { time: number; frequency: number }[]) => {
    const validPoints = pitchData.filter(p => p.frequency != null);
    if (validPoints.length === 0) return pitchData;

    const mean = validPoints.reduce((sum, p) => sum + (p.frequency ?? 0), 0) / validPoints.length;

    return pitchData
      .filter(p => p.frequency != null)
      .map(p => ({
        ...p,
        frequency: (p.frequency as number) - mean,
      }));
  };


  function countMatches(userPitch: PitchPoint[], referencePitch: PitchPoint[], tolerance = 15): number {
    let totalPoints = 0;
    let correctPoints = 0

    userPitch.forEach((point, index) => {
      totalPoints += 1;
      const refPoint = referencePitch[index];
      if (refPoint && Math.abs(point.frequency - refPoint.frequency) < tolerance) {
        correctPoints += 1;
      }
    });

    return totalPoints > 0 ? correctPoints / totalPoints : 0;
  }




  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-screen text-[50px]">
      <h1>你好！欢迎来到语音练习。</h1>
      <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full px-8 h-[600px]">

        <div className='flex justify-center items-center w-full h-full'>
          <button className="p-4 rounded-full bg-blue-500 text-white hover:bg-blue-600" onClick={handlePlay}>
            <Play />
          </button>
        </div>

        <div>{referencePitch.length > 0 && (
          <LineChart width={800} height={300} data={referencePitch}>
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

        <div>{userPitch.length > 0 && (
          <>
            <LineChart width={800} height={300} data={mergedPitchData}>
              <XAxis dataKey="time" tick={{ fontSize: 14 }} />
              <YAxis tick={{ fontSize: 14 }} />
              <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
              <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
            </LineChart>
            <p className="text-lg mt-2 text-center text-white">
              You were {(countMatches(userPitch, referencePitch) * 100).toFixed(1)}% accurate!
            </p>
            <div>
              {(countMatches(userPitch, referencePitch) * 100) > 90 && (
                <button className='bg-green-500 p-4 text-lg text-center rounded-3xl' onClick={() => router.push('/page')}>
                  Success! Next?
                </button>
              )}</div>
          </>
        )}</div>
      </div>
    </main>
  );
}