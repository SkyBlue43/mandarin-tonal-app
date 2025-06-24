'use client'

import Default from '@/app/components/default';
import Time from '@/app/components/time';
import MFA from '@/app/components/mfa';
import Voiceless from '@/app/components/voiceless';
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Mic, Play, Square } from 'lucide-react';


export default function Main() {
  const [chosenAudio, setChosenAudio] = useState('')
  const [chosenPhrase, setChosenPhrase] = useState('')
  const [audioChoice, setAudioChoice] = useState(0);
  const [testChoice, setTestChoice] = useState(0);


  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  //new ones
  const [referenceBlob, setReferenceBlob] = useState<Blob | null>(null);
  const [userBlob, setUserBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (audioChoice === 0) {
      setChosenAudio('chinese_output.mp3');
      setChosenPhrase('mǎ 馬 马');
    } else if (audioChoice === 1) {
      setChosenAudio('chinese_phrase.mp3');
      setChosenPhrase('你好！你今天怎么样？');
    }
  }, [audioChoice]);


  const handlePlay = async () => {
    const audio = new Audio(`/audio/${chosenAudio}`);
    audio.play();
    const response = await fetch(`/audio/${chosenAudio}`);
    const blob = await response.blob();
    setReferenceBlob(blob);
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
      setUserBlob(audioBlob);
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
    <main className="flex flex-col items-center justify-start p-6 min-h-screen w-screen text-[50px]">
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

        <button
          className={`p-3 rounded-2xl ${testChoice != 0 ? 'bg-pink-500 hover:bg-pink-600 w-30' : 'bg-white border border-2 border-pink-500 text-pink-500'}`}
          onClick={() => setTestChoice(0)}>
          DTW
        </button>

        <button
          className={`p-3 rounded-2xl ${testChoice != 1 ? 'bg-pink-500 hover:bg-pink-600 w-30' : 'bg-white border border-2 border-pink-500 text-pink-500'}`}
          onClick={() => setTestChoice(1)}>
          MFA
        </button>

        <button
          className={`p-3 rounded-2xl ${testChoice != 2 ? 'bg-pink-500 hover:bg-pink-600 w-30' : 'bg-white border border-2 border-pink-500 text-pink-500'}`}
          onClick={() => setTestChoice(2)}>
          Voiceless
        </button>
      </header>

      <h1>{chosenPhrase}</h1>

      <div className="grid grid-cols-3 grid-rows-2 gap-4 w-full px-8 h-[800px]">

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

        <div className='col-span-2 col-start-2 row-start-1 row-end-2 flex gap-4 justify-betwwen items-start'><Default
          userBlob={userBlob}
          referenceBlob={referenceBlob}
          chosenAudio={chosenAudio}
        /></div>
        

        <div>
          {/* This is where the audio recording(s) should go */}
        </div>

        <div className="col-span-2 col-start-2 row-start-2 row-end-3 flex gap-4 justify-between items-start">
          {testChoice === 0 && (
            <Time
              userBlob={userBlob}
              referenceBlob={referenceBlob}
              chosenAudio={chosenAudio}
            />
          )}

          {testChoice === 1 && (
            <MFA
              userBlob={userBlob}
              referenceBlob={referenceBlob}
              chosenAudio={chosenAudio}
              chosenPhrase={chosenPhrase}
            />
          )}

          {testChoice === 2 && (
            <Voiceless
              userBlob={userBlob}
              referenceBlob={referenceBlob}
              chosenAudio={chosenAudio}
            />
          )}
        </div>
      </div>
    </main>
  );
}

