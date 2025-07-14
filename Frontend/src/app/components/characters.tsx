import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react'

type Props = {
  userBlob: Blob | null;
  referenceBlob: Blob | null;
  chosenAudio: string;
};

type PitchPoint = {
  time: number;
  frequency: number;
};

export default function Characters({
  userBlob,
  referenceBlob,
  chosenAudio,
}: Props) {
  const router = useRouter();
  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [alignedGraphData, setAlignedGraphData] = useState<any[]>([]);
  const [userWordsArray, setUserWordsArray] = useState<any[]>([])
  const [referenceWordsArray, setReferenceWordsArray] = useState<any[]>([])

  useEffect(() => {
    const analyzeReference = async () => {
      const data = await analyzeAudio(referenceBlob, chosenAudio);
      if (data) setReferencePitch(data.pitch);
    };

    if (referenceBlob) {
      analyzeReference();
    }
  }, [referenceBlob, chosenAudio]);

  useEffect(() => {
    const analyzeUser = async () => {
      const data = await analyzeAudio(userBlob, "recording" + chosenAudio);
      if (data) {
        setUserPitch(data.pitch);
        if (referencePitch.length > 0) {
          const reference_words_array = await transcribeAudio(referenceBlob, "recording" + chosenAudio);
          setReferenceWordsArray(reference_words_array);
          console.log('Reference Array: ', reference_words_array);
          const user_words_array = await transcribeAudio(userBlob, "recording2" + chosenAudio);
          setUserWordsArray(user_words_array);
          console.log('User Array: ', user_words_array);
          DTW(data.pitch, referencePitch, reference_words_array, user_words_array);

        }
      }
    };

    if (userBlob) {
      analyzeUser();
    }
  }, [userBlob, chosenAudio]);

  
  const transcribeAudio = async (audio_blob: Blob | null, audio_location: string) => {
    if (audio_blob === null) { return null}
    const formData = new FormData();
    formData.append('file', audio_blob, audio_location);
    const result = await fetch('http://localhost:8000/transcribe', {
      method: 'POST',
      body: formData,
    });
    const data = await result.json();
    console.log('Transcribed data: ', data);
    const wordsArray = data[0]?.words || [];
    return wordsArray;
  }

  const analyzeAudio = async (audio_blob: Blob | null, audio_location: string) => {
    if (audio_blob === null) { return null }
    const formData = new FormData();
    formData.append('file', audio_blob, audio_location);
    const result = await fetch('http://localhost:8000/analyze-audio-voiceless', {
      method: 'POST',
      body: formData,
    });
    const data = await result.json();
    console.log('Pitch data:', data);
    return data
  };

  const DTW = async (userPitch: PitchPoint[], referencePitch: PitchPoint[], referenceWordArray: any[], userWordArray: any[]) => {
    const formData = new FormData();
    formData.append('reference_pitch', JSON.stringify({
      frequency: referencePitch.map(p => p.frequency),
      time: referencePitch.map(p => p.time)
    }));
    formData.append('user_pitch', JSON.stringify({
      frequency: userPitch.map(p => p.frequency),
      time: userPitch.map(p => p.time)
    }));
    formData.append('words_reference', JSON.stringify(referenceWordArray));
    formData.append('words_user', JSON.stringify(userWordArray));
    const result = await fetch('/dtw_characters', {
      method: 'POST',
      body: formData
    });
    const data = await result.json();
    console.log("DTW result:", data);
    setAlignedGraphData(data.alignement);
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
    <>
      <div>{referencePitch.length > 0 && (
        <LineChart width={500} height={300} data={referencePitch}>
          <XAxis dataKey="time" tick={{ fontSize: 14 }} />
          <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value) => value.toFixed(1)} />
          <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
        </LineChart>
      )}</div>

      <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
        <>
          <LineChart width={500} height={300} data={alignedGraphData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value) => value.toFixed(1)} />
            <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
            <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
          </LineChart>
          <p className="text-lg mt-2 text-center text-white">
            You were {(countMatches(alignedGraphData) * 100).toFixed(1)}% accurate!
          </p>
        </>
      )}</div>
    </>
  );
}