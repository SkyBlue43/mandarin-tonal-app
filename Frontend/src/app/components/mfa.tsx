import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react'

type Props = {
  userBlob: Blob | null;
  referenceBlob: Blob | null;
  chosenAudio: string;
  chosenPhrase: string;
};

type PitchPoint = {
  time: number;
  frequency: number;
};

type MFAWord = {
  start: number;
  end: number;
  text: string;
};

type MFAData = {
  alignment: {
    words: MFAWord[];
    phones: any[];
  };
};

export default function MFA({
  userBlob,
  referenceBlob,
  chosenAudio,
  chosenPhrase,
}: Props) {
  const router = useRouter();
  const [userPitch, setUserPitch] = useState<PitchPoint[]>([]);
  const [referencePitch, setReferencePitch] = useState<PitchPoint[]>([]);
  const [alignedGraphData, setAlignedGraphData] = useState<any[]>([]);
  const [referenceMFA, setReferenceMFA] = useState<MFAData | null>(null);

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
    if (!userBlob) return;

    (async () => {
      try {
        const data = await analyzeAudio(userBlob, "recording" + chosenAudio);
        if (data) {
          setUserPitch(data.pitch);

          if (referencePitch.length > 0) {
            await DTW(data.pitch, referencePitch);
          }
        }

        // Fire MFA in background, don't block pitch
        if (!referenceMFA || referenceMFA.alignment.words.length === 0) {
          getDataMFA(referenceBlob, chosenAudio, chosenPhrase)
            .then(dataMFA => {
              if (dataMFA) {
                console.log("MFA result:", dataMFA);
                setReferenceMFA(dataMFA);
              }
            })
            .catch(err => {
              console.error("MFA fetch error:", err);
            });
        }

      } catch (error) {
        console.error("Error during analysis:", error);
      }
    })();
  }, [userBlob, chosenAudio, chosenPhrase, referencePitch]);




  const analyzeAudio = async (audio_blob: Blob | null, audio_location: string) => {
    if (audio_blob === null) { return null }
    const formData = new FormData();
    formData.append('file', audio_blob, audio_location);
    const result = await fetch('http://localhost:8000/analyze-audio', {
      method: 'POST',
      body: formData,
    });
    const data = await result.json();
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

  const getDataMFA = async (audio_blob: Blob | null, audio_location: string, audio_text: string) => {
    if (audio_blob === null) { return null }
    const formData = new FormData();
    formData.append('file', audio_blob, audio_location);
    formData.append('transcript', audio_text);
    const result = await fetch('http://localhost:8000/mfa', {
      method: 'POST',
      body: formData,
    });
    const data = await result.json();
    console.log("MFA data:", data);
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
    setAlignedGraphData(data.aligned);
  };


  return (
    <>
      <div>{referencePitch.length > 0 && (
        <>
          <LineChart width={500} height={300} data={referencePitch}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
            <Line type="monotone" dataKey="frequency" stroke="#8884d8" dot={false} strokeWidth={5} />
          </LineChart>

          {referenceMFA && (
            <div className="relative mt-2 ml-14" style={{ width: '400px', height: '24px' }}>
              {referenceMFA.alignment.words.map(word => (
                <span
                  key={word.start}
                  className="absolute text-center whitespace-nowrap text-lg text-white"
                  style={{
                    left: `${((((word.start + word.end) / 2) - 0.1) / (referencePitch.at(-1)?.time || 1)) * 100}%`,
                  }}
                >
                  {word.text}
                </span>
              ))}
            </div>

          )}
        </>


      )}</div>

      <div>{Array.isArray(alignedGraphData) && alignedGraphData.length > 0 && (
        <>
          <LineChart width={500} height={300} data={alignedGraphData}>
            <XAxis dataKey="time" tick={{ fontSize: 14 }} />
            <YAxis tick={{ fontSize: 14 }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => value.toFixed(1)} />
            <Line type="monotone" dataKey="user" stroke="#82ca9d" dot={false} name="Your Pitch" strokeWidth={5} />
            <Line type="monotone" dataKey="reference" stroke="#8884d8" dot={false} name="Reference Pitch" strokeWidth={5} />
          </LineChart>

          {referenceMFA && (
            <div className="relative mt-2 ml-14" style={{ width: '400px', height: '24px' }}>
              {referenceMFA.alignment.words.map(word => (
                <span
                  key={word.start}
                  className="absolute text-center whitespace-nowrap text-lg text-white"
                  style={{
                    left: `${((((word.start + word.end) / 2) - 0.1) / (referencePitch.at(-1)?.time || 1)) * 100}%`,
                  }}
                >
                  {word.text}
                </span>
              ))}
            </div>
          )}


          <p className="text-lg mt-2 text-center text-white">
            You were {(countMatches(alignedGraphData) * 100).toFixed(1)}% accurate!
          </p>
        </>
      )}</div>
    </>
  );
}
