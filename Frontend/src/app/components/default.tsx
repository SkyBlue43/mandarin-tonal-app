import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react'

type Props = {
  userBlob : Blob | null;
  referenceBlob : Blob | null;
  chosenAudio : string;
};

type PitchPoint = {
  time: number;
  frequency: number;
};

export default function Default({
  userBlob,
  referenceBlob,
  chosenAudio,
}: Props) {
  const router = useRouter();
  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [alignedGraphData, setAlignedGraphData] = useState<any[]>([]);

  useEffect(() => {
    const analyze = async () => {
      const referenceData = await analyzeAudio(referenceBlob, chosenAudio);
      const userData = await analyzeAudio(userBlob, "recording" + chosenAudio);
      if (referenceData && userData) {
        setReferencePitch(referenceData.pitch);
        setUserPitch(userData.pitch);
        DTW(userData.pitch, referenceData.pitch);
      }
    };
  
    if (referenceBlob && userBlob) {
      analyze();
    }
  }, [referenceBlob, userBlob, chosenAudio]);
  

  const analyzeAudio = async (audio_blob: Blob | null, audio_location: string) => {
    if (audio_blob === null){ return null }
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


  return (
    <>
      <div>{referencePitch.length > 0 && (
        <LineChart width={500} height={300} data={referencePitch}>
          <XAxis dataKey="time" tick={{ fontSize: 14 }} />
          <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
          <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
        </LineChart>
      )}</div>

      <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
        <>
          <LineChart width={500} height={300} data={alignedGraphData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
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
